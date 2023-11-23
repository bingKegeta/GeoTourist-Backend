from typing import Dict, Any, List, Optional, Tuple
import requests
import argparse
import pandas as pd
import numpy as np
import sklearn.neighbors
import random
from geopy.exc import GeocoderTimedOut
from geopy.geocoders import Nominatim

ONEHOT_MAPPING = {
    'Trewartha' : ['Ar', 'Am', 'Aw', 'Cf', 'Cs', 'Cw', 'Cr', 'Do', 'Dc', 'Eo', 'Ec', 'Ft', 'Fi', 'BW', 'BS'], # Wet to dry ~ Related by extremity of climate
    'ClimateZone' : ['Subtropical Monsoon', 'Tropical Wet', 'Tropical Wet-And-Dry', 'Subtropical Humid', 'Subtropical Dry', 'Temperate Continental', 'Temperate Oceanic', 'Boreal, Continental Subarctic', 'Boreal, Maritime Subarctic', 'Steppe or Semiarid', 'Tundra', 'Desert or Arid', 'Ice Cap'], # Wet to dry ~ Related by extremity of climate
}


def make_graphql_request(query_filename: str = "./gql/users.graphql", variables: Dict[str, Any] = {}) -> Dict[str, Any]:
    """
    Send a Query or Mutate request to GraphQL and get a response.
    Sample uses:
    >>>print(make_graphql_request()['data'])
    >>>print(make_graphql_request("./gql/locations.graphql", {'user_id': USER_IDS})['data'])
    """
    with open(query_filename) as gql_query:
        query = gql_query.read()
        gql_query.close()
    result = requests.post("http://localhost:5000/api", json={'query': query , 'variables': variables}).json()
    for key in result['data']:
        if result['data'][key] == "Failure!":
            raise Exception("GraphQL query returned \"Failure!\"")
    return result

def get_coordinates_by_name(city: str, geolocator: Nominatim = Nominatim(user_agent="tourfusion"), tries: int = 5) -> Optional[Tuple[float, float]]:
    """Return latitude and longitude of the given city."""
    for _ in range(tries):
        try:
            location = geolocator.geocode(city)
            return (location.latitude, location.longitude)
        except GeocoderTimedOut:
            pass
    return None

def location_json_to_list(location_json: Dict[str, Any]) -> List[Any]:
    """
    Unified way to convert a full location request to a list for use by the model.
    We need this to ensure all indices of the values in the model are maintained
    throughout the training and inference process.
    """
    return [location_json['location']['latitude'], location_json['location']['longitude'], location_json['elevation'], location_json['avg_temp'], location_json['trewartha'], location_json['climate_zone']]

def add_random_locations(user_id: str, k: int) -> None:
    """Add random locations to the user with the given user_id's account."""
    for i in range(k):
        try:
            result = make_graphql_request(
                        "./gql/addLocations.graphql",
                        {
                            'user_id': user_id,
                            'name': {
                                'display': f"location_{i}",
                                'street': f"street_{i}",
                                'city': f"city_{i}",
                                'country': f"country_{i}",
                                'address': f"address_{i}",
                                'postal': f"postal_{i}"
                            },
                            'latitude': random.random() * 180 - 90,
                            'longitude': random.random() * 360 - 180
                        }
                    )
            print(f"{i+1}/{k}: {result}")
        except Exception as e:
            print(e)

def query_location_data(user_id: str) -> List[Dict[str, Any]]:
    """
    Grab all location data for all locations held by the user
    with the given user_id.
    """
    return make_graphql_request("./gql/locations.graphql", {'user_id': user_id})['data']['locations']

def set_class_data(user_id: str, possible_locations: str) -> None:
    """
    One-time use. Gets static data of all cities in possible_locations
    and stores the data in that same file. Run after adding a city
    in the possible_locations file by writing a row:
    {Rank},{City},{Country}
    """

    # Read from the classes file
    df = pd.read_csv(possible_locations)

    # Get latitude and longitude of all classes
    city_comma_country_series = df['City'] + ", " + df['Country']
    coordinates_by_class = np.array([get_coordinates_by_name(city_comma_country) for city_comma_country in city_comma_country_series])

    # Insert latitude and longitude into the dataframe
    df['Latitude'] = coordinates_by_class[:,0]
    df['Longitude'] = coordinates_by_class[:,1]

    # Get remaining features
    location_features = []
    for idx, row in df.iterrows():
        try:
            make_graphql_request(
                    "./gql/addLocations.graphql",
                    {
                        'user_id': user_id,
                        'name': {
                            'display': f"location_{idx}",
                            'street': f"street_{idx}",
                            'city': row['City'],
                            'country': row['Country'],
                            'address': f"address_{idx}",
                            'postal': f"postal_{idx}"
                        },
                        'latitude': row['Latitude'],
                        'longitude': row['Longitude']
                    }
                )
            added_location = make_graphql_request("./gql/locations.graphql", {'user_id': user_id})['data']['locations'][0]
            location_features.append(location_json_to_list(added_location))
            make_graphql_request("./gql/deleteLocation.graphql", { '_id': added_location['_id'] })
            print(f"Row added successfully: {added_location}")
        except Exception as e:
            print(e)

    location_features = np.array(location_features)

    df['Elevation'] = location_features[:,2]
    df['AverageTemperature'] = location_features[:,3]
    df['Trewartha'] = location_features[:,4]
    df['ClimateZone'] = location_features[:,5]
    
    # Write the newfound data to the classes file
    df.to_csv(possible_locations, index=False)
    print("Data successfully written to possible_locations csv!")

def encode(df: pd.DataFrame, column: str) -> pd.DataFrame:
    words = df[column].to_list()
    # print(f"ENCODE {column}: {words}")
    return pd.DataFrame({column : [ONEHOT_MAPPING[column].index(word) for word in words]})

def decode(df: pd.DataFrame, column: str) -> pd.DataFrame:
    onehot_encoding = df[column].to_list()
    # print(f"DECODE {column}: {onehot_encoding}")
    return pd.DataFrame({column : [ONEHOT_MAPPING[column][int(onehot_number)] for onehot_number in onehot_encoding]})

def sample_and_agglomerate_locations(user_id: str, possible_locations: str, k: int = 100) -> pd.DataFrame:
    """
    Create a dataset using the possible_locations file for class information.
    """

    print("Beginning dataset agglomeration.")
    # Get some random locations to work with
    add_random_locations(user_id, k)
    locations = query_location_data(user_id)

    # Remove all oceanic locations and force a 0 ranking
    locations =  np.array([[0] + location_json_to_list(location) for location in locations if location['elevation'] != 0])
    assert len(locations) > 0
    locations[:,5] = encode(pd.DataFrame({'Trewartha' : locations[:,5]}), 'Trewartha').to_numpy()[0]
    locations[:,6] = encode(pd.DataFrame({'ClimateZone' : locations[:,6]}), 'ClimateZone').to_numpy()[0]
    locations = np.array([[float(location) for location in location_set] for location_set in locations])

    # Read from the classes file
    data = pd.read_csv(possible_locations)

    # Grab classes as "{city}, {country}" and encode with one-hot
    classes = (data['City'] + ", " + data['Country']).to_list()
    encoded_classes = (data['Rank'].astype(float) - 1.).to_numpy()

    # Map the encodings to their respective city names for later decoding
    ONEHOT_MAPPING['City, Country'] = {}
    for (encoding, single_class) in zip(encoded_classes, classes):
        ONEHOT_MAPPING['City, Country'].update({encoding : single_class})

    # Grab all features
    features = data[['Rank', 'Latitude', 'Longitude', 'Elevation', 'AverageTemperature', 'Trewartha', 'ClimateZone']]
    encoded_trewartha = encode(features, column='Trewartha')
    encoded_climatezone = encode(features, column='ClimateZone')
    encoded_features = np.c_[
            features[['Rank', 'Latitude', 'Longitude', 'Elevation', 'AverageTemperature']].astype(float).to_numpy(),
            encoded_trewartha['Trewartha'].astype(float).to_numpy(),
            encoded_climatezone['ClimateZone'].astype(float).to_numpy()
        ]
    # Get the closest label for every one of our random locations
    classifier = sklearn.neighbors.KNeighborsClassifier(n_neighbors=1).fit(encoded_features, encoded_classes)
    predictions = classifier.predict(locations)

    # Decode using the one-hot mapping made earlier
    classifications = pd.DataFrame({'Class' : [ONEHOT_MAPPING['City, Country'][int(prediction)] for prediction in predictions]})

    return (
        pd.DataFrame(
            {
                'Latitude' : locations[:,1],
                'Longitude' : locations[:,2],
                'Elevation' : locations[:,3],
                'AverageTemperature' : locations[:,4],
            }
        )
        .join(decode(encoded_trewartha, 'Trewartha'))
        .join(decode(encoded_climatezone, 'ClimateZone'))
        .join(classifications)
    )

def fabricate_dataset(user_id: str, possible_locations: str, train_data_manifest: str, size: int = 100) -> None:
    """
    Perform dataset creation using possible_locations for identifying
    classes, and write the new dataset to train_data_manifest.
    """
    df = sample_and_agglomerate_locations(user_id, possible_locations, size)
    df.to_csv(train_data_manifest, index=False)

def main(args):
    print("Beginning dataset fabrication process...")

    # Make a random user for dataset creation
    user_id = make_graphql_request(
            "./gql/addUser.graphql",
            {
                'email' : "x" + str(random.random() * random.random()) + "@gmail.com",
                'username' : "x" + str(random.random() * random.random()),
                'password' : "x" + str(random.random() * random.random())
            }
        )['data']['addUser']
    print(f"User added: {user_id}")

    # Set up the classes file
    if args.set_class_data:
        set_class_data(user_id, args.possible_locations)
    
    print("Beginning final fabrication phase.")
    # Create the master train_data_manifest file
    fabricate_dataset(user_id, args.possible_locations, args.train_data_manifest, size=500)

    print("Dataset fabricated!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
            prog='dataset.py',
            description='Performs dataset fabrication for the specified csv.'
        )
    parser.add_argument('--set_class_data', default=False)
    parser.add_argument('--possible_locations', default='./data/classes.csv')
    parser.add_argument('--train_data_manifest', default='./data/generated/master.csv')
    args = parser.parse_args()
    main(args)
