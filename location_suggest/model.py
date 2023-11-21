from typing import Any, List, Tuple, Optional

import argparse
import numpy as np
import os
import pandas as pd
import pickle
import random
import requests
from sklearn.ensemble import RandomForestClassifier
import str2bool
from dataset import make_graphql_request, location_json_to_list, encode, decode

class DestinationSuggestor:
    model: Optional[RandomForestClassifier]
    onehot_mapping: Optional[List]

    def __init__(self):
        self.model = None
        self.onehot_mapping = None

    def _sample_4_destinations(self, location_feature_list: List[List[float]], class_col_idx: int, k: int = 5) -> Tuple[List[List[List[float]]], List[float]]:
        # A custom bagging algorithm
        sampled = []
        labels = []
        for _ in range(k):
            for location_feature_set in location_feature_list:
                current_sample = [
                    location_feature_set,
                    next(
                            (feature_set for feature_set in location_feature_list[::-1] 
                                if int(feature_set[class_col_idx]) == int(location_feature_set[class_col_idx])),
                            random.choice(location_feature_list)
                        )
                ]
                for _ in range(2):
                    current_sample.append(random.choice(location_feature_list))
                random.shuffle(current_sample)
                sampled.append(np.array(current_sample))
                print(sampled)
                labels.append(np.argmax(np.bincount(np.array(sampled[-1][:,class_col_idx], dtype=np.int32))))
        return (sampled, labels)
    
    def prep_data(self, train_data_manifest_filename: str) -> Tuple[List[List[float]], List[float]]:
        df = pd.read_csv(train_data_manifest_filename)

        for feature in df.columns:
            if feature in ['Trewartha', 'ClimateZone']:
                df[feature] = encode(df, feature)[feature].astype(float)
            elif feature != 'Class':
                df[feature] = df[feature].astype(float)

        self.onehot_mapping = list(set(df['Class'].to_list()))
        df['Class'] = pd.DataFrame({'Class' : [self.onehot_mapping.index(item) for item in df['Class']]})['Class'].astype(float)
        
        sampled, labels = self._sample_4_destinations(df.to_numpy(), df.columns.get_loc('Class'))
        return ([location_quad.flatten() for location_quad in sampled], labels)

    def train(self, train_input: List[List[float]], train_labels: List[float]) -> None:
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
    suggestor = DestinationSuggestor()

    if (args.train):
        print("Beginning data preparation and training...")
        suggestor.train(*suggestor.prep_data(args.train_data_manifest))

        print("Saving the model...")
        os.makedirs('./bin', exist_ok=True)
        suggestor.save(args.model_filename)
    else:
        print("Loading the model...")
        suggestor.load(args.model_filename)

    print("Performing inference...")
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
    parser.add_argument('--train_data_manifest', default='./data/generated/master.csv')
    parser.add_argument('--train', type=bool, default=True)
    # Optional args
    parser.add_argument('--model_filename', default='./bin/dest_suggestor.pkl')
    parser.add_argument('--user_id', default='653bfedf1e7c5a2367365f16')
    args = parser.parse_args()
    main(args)
