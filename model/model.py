from typing import Dict, Any, List
import requests
import random
from sklearn.ensemble import AdaBoostRegressor
import pandas as pd

USER_IDS = ["653bfedf1e7c5a2367365f16", "6540934aa141ee4ef2453c5a", "6540935ca141ee4ef2453c5b", "65409369a141ee4ef2453c5c", "65409377a141ee4ef2453c5d"]

def make_graphql_request(query_filename: str = "./gql/users.graphql", variables: Dict[str, Any] = {}) -> Dict[str, Any]:
    """
    Sample uses:
    >>>print(make_graphql_request().json()['data'])
    >>>print(make_graphql_request("./gql/locations.graphql", {'user_id': USER_IDS}).json()['data'])
    """
    with open(query_filename) as gql_query:
        query = gql_query.read()
    return requests.post("http://localhost:5000/api", json={'query': query , 'variables': variables})

#TODO: Make this function return useful train data
def do_real_locations_per_user_mimic_requests() -> List[Dict]:
    json_data = [{}, {}, {}]
    return json_data

def data_preparation():
    df_json = {}
    json_data = do_real_locations_per_user_mimic_requests()
    return pd.DataFrame(json_data)

def add_random_locations(user_id: str, k: int) -> None:
    for i in range(k):
        print(make_graphql_request("./gql/addLocations.graphql", {'user_id': user_id, 'name': f"location_{i}", 'latitude': random.random() * 180 - 90, 'longitude': random.random() * 360 - 180}).json())

def main():
    df = data_preparation()
    df = df.fillna(0)

    regr = AdaBoostRegressor(random_state=0, n_estimators=100)
    regr.fit(X, y)
    

if __name__ == "__main__":
    main()