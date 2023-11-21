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
from dataset import get_coordinates_by_name, make_graphql_request, location_json_to_list

class DestinationSuggestor:
    model: Optional[RandomForestClassifier]

    def __init__(self, onehot_mapping: List[str]):
        self.model = None
        self.onehot_mapping = onehot_mapping
    
    def prep_data(self, train_data_manifest_filename: str) -> Tuple[np.ndarray]:
        df = pd.read_csv(train_data_manifest_filename).fillna(0)
        train_input = df.loc[:, df.columns != 'City, Country']
        train_labels = df['City, Country']
        return (train_input, train_labels)

    def train(self, train_input: np.array, train_labels: np.array):
        self.model = RandomForestClassifier()
        self.model.fit(train_input, train_labels)

    def encode_4_destinations(self, destinations: List[List[Any]]) -> np.array:
        return [location_json_to_list(destination) for destination in destinations]
    
    def infer(self, past_4_destinations: List[List[Any]]) -> str:
        if self.model:
            encoded_prediction = self.model.predict(self.encode_4_destinations(past_4_destinations))
        else:
            raise RuntimeError("Tried to infer while DestinationSuggestor model was not trained or loaded.")
        
        # Return a json of the recommended locations
        return self.onehot_mapping[encoded_prediction]

    def save(self, filename: str) -> None:
        with open(filename, 'wb') as modelfile:
            pickle.dump(self.model, modelfile)
            modelfile.close()
        
    def load(self, filename: str) -> None:
        with open(filename, 'rb') as modelfile:
            self.model = pickle.load(modelfile)
            modelfile.close()


def main(args):
    df = pd.read_csv(args.mapping_filename)
    onehot_mapping = (df['City'] + ", " + df['Country']).to_numpy()
    suggestor = DestinationSuggestor(onehot_mapping)

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
    # Important args
    parser.add_argument('--mapping_filename', default='./data/classes.csv')
    parser.add_argument('--train_data_manifest', default='./data/generated/master.csv')
    parser.add_argument('--train', type=str2bool, default=True)
    # Optional args
    parser.add_argument('--model_filename', default='./bin/dest_suggestor.pkl')
    parser.add_argument('--user_id', default='653bfedf1e7c5a2367365f16')
    args = parser.parse_args()
    main(args)
