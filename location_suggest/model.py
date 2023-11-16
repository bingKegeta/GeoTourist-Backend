from typing import Dict, Any, List, Tuple, Optional

import argparse
import numpy as np
import os
import pandas as pd
import pickle
import random
import requests
from sklearn.ensemble import RandomForestClassifier, AdaBoostClassifier
import str2bool
from dataset import getCoordinates, make_graphql_request, location_json_to_list


class DestinationSuggestor:
    model: Optional[RandomForestClassifier | AdaBoostClassifier]
    onehot_mapping: np.array
    country_map: np.array

    def __init__(self, mapping_filename):
        self.model = None
        self.onehot_mapping = np.append(np.array(["UNK"]), pd.read_csv(mapping_filename)['City'].to_numpy().flatten())
        self.country_map = np.append(np.array(["UNK"]), pd.read_csv(mapping_filename)['Country'].to_numpy().flatten())

    def prep_data(self, train_data_manifest_filename: str) -> Tuple[np.ndarray]:
        df = pd.read_csv(train_data_manifest_filename).fillna(0)
        train_input = []
        train_labels = []
        return (train_input, train_labels)

    def train(self, train_input: np.array, train_labels: np.array):
        self.model = AdaBoostClassifier(random_state=0, n_estimators=100)
        self.model.fit(train_input, train_labels)
    
    def infer(self, past_4_destinations: np.array) -> List[Dict[str, Any]]:
        if self.model:
            encoded_prediction = self.model.predict(past_4_destinations)
        else:
            raise RuntimeError("Tried to infer while DestinationSuggestor model was not trained or loaded.")
        
        decoded_city_names = [self.onehot_mapping[city_num] for city_num in encoded_prediction]
        decoded_country_names = [self.country_map[country_num] for country_num in encoded_prediction]
        decoded_city_coordinates = [getCoordinates(city_name) for city_name in decoded_city_names]

        # Return a json of the recommended locations
        return [{
            "city": city_name,
            "country": country_name,
            "latitude": coordinates[0],
            "longitude": coordinates[1]
        } for (city_name, country_name, coordinates) in zip(decoded_city_names, decoded_country_names, decoded_city_coordinates)]

    def save(self, filename: str) -> None:
        with open(filename, 'wb') as modelfile:
            pickle.dump(self.model, modelfile)
            modelfile.close()
        
    def load(self, filename: str) -> None:
        with open(filename, 'rb') as modelfile:
            self.model = pickle.load(modelfile)
            modelfile.close()


def main(args):
    suggestor = DestinationSuggestor()

    if (args.train):
        print("Stage 1: DATA PREPARATION")
        train_input, train_labels = suggestor.prep_data(args.train_data_manifest)

        print("Stage 2: TRAIN AND FIT TREE MODEL")
        suggestor.train(train_input, train_labels)

        # Save the model
        os.makedirs('./bin', exist_ok=True)
        suggestor.save(args.model_filename)

        print("Stage 3: PERFORM SAMPLE INFERENCE")
    else:
        # Load the model
        suggestor.load(args.model_filename)

    if args.user_id:
        most_recent_locations = np.array(
                [location_json_to_list(location_json)['data']['locations']
                 for location_json in make_graphql_request("./gql/locations.graphql", {'user_id': args.user_id})[-4:]]
            )
        return suggestor.infer(most_recent_locations)
    else:
        return {"Error": "No user_id provided to utilize for inference."}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
            prog='model.py',
            description='Performs training based on the data in the specified csv.'
        )
    parser.add_argument('mapping_filename', default='./data/classes.csv')
    parser.add_argument('train', type=str2bool, default=True)
    parser.add_argument('train_data_manifest', default='./data/generated/master.csv')
    parser.add_argument('model_filename', default='./bin/dest_suggestor.pkl')
    parser.add_argument('user_id', default='653bfedf1e7c5a2367365f16')
    args = parser.parse_args()
    main(args)
