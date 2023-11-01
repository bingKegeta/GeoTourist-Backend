from typing import Dict, Any, List, Optional, Tuple
import requests
import argparse
import pandas as pd
from geopy.exc import GeocoderTimedOut
from geopy.geocoders import Nominatim

USER_IDS = ["653bfedf1e7c5a2367365f16", "6540934aa141ee4ef2453c5a", "6540935ca141ee4ef2453c5b", "65409369a141ee4ef2453c5c", "65409377a141ee4ef2453c5d"]

def getCoordinates(city: str, geolocator: Nominatim = Nominatim(user_agent="tourfusion"), tries: int = 5) -> Optional[Tuple[float, float]]:
    """Return latitude and longitude of the given city."""
    for _ in range(tries):
        try:
            location = geolocator.geocode(city)
            return (location.latitude, location.longitude)
        except GeocoderTimedOut:
            pass
    return None

def make_graphql_request(query_filename: str = "./gql/users.graphql", variables: Dict[str, Any] = {}) -> Dict[str, Any]:
    """
    Run a Query or Mutate request to GraphQL
    Sample uses:
    >>>print(make_graphql_request().json()['data'])
    >>>print(make_graphql_request("./gql/locations.graphql", {'user_id': USER_IDS}).json()['data'])
    """
    with open(query_filename) as gql_query:
        query = gql_query.read()
        gql_query.close()
    return requests.post("http://localhost:5000/api", json={'query': query , 'variables': variables})

def location_json_to_list(location_json: Dict[str, Any]) -> List[str, Any]:
    """
    Unified way to convert a full location request to a list for use by the model.
    We need this to ensure all indices of the values in the model are maintained
    throughout the training and inference process.
    """
    return [location_json['latitude'], location_json['longitude'], location_json['elevation'], location_json['avg_temp'], location_json['trewartha'], location_json['climate_zone']]

#TODO: Make this function return useful train data
def do_real_locations_per_user_mimic_requests() -> List[Dict]:
    json_data = [{}, {}, {}]
    return json_data

def add_random_locations(user_id: str, k: int) -> None:
    for i in range(k):
        print(make_graphql_request("./gql/addLocations.graphql", {'user_id': user_id, 'name': f"location_{i}", 'latitude': random.random() * 180 - 90, 'longitude': random.random() * 360 - 180}).json())

def main(args):
    print("Stage 0: FABRICATE DATASET")
    with open(args.possible_locations) as plfile:
        df = pd.read_csv(plfile)
        plfile.close()
    

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
            prog='model.py',
            description='Performs training based on the data in the specified csv.'
        )
    parser.add_argument('possible_locations', default='./data/possible_locations.csv')
    parser.add_argument('train_data_manifest', default='./data/generated/location_assoc.csv')
    args = parser.parse_args()
    main(args)
