from typing import Dict, Any, List, Tuple, Optional
import argparse
import numpy as np
import os
import pandas as pd
import pickle
import random
import requests
from sklearn.ensemble import RandomForestClassifier
from dataset import make_graphql_request, location_json_to_list, encode

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
                labels.append(np.argmax(np.bincount(np.array(sampled[-1][:,class_col_idx], dtype=np.int32))))
                sampled[-1] = np.array([[feature for idx, feature in enumerate(feature_set) if idx != class_col_idx] for feature_set in sampled[-1]])
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
    
    def retrieve_classes(self, train_data_manifest_filename: str) -> None:
        df = pd.read_csv(train_data_manifest_filename)
        self.onehot_mapping = list(set(df['Class'].to_list()))
        
    def train(self, train_input: List[List[float]], train_labels: List[float]) -> None:
        self.model = RandomForestClassifier(n_estimators=200)
        self.model.fit(train_input, train_labels)

    def infer(self, encoded_past_4_destinations: pd.DataFrame) -> str:
        for feature in encoded_past_4_destinations.columns:
            encoded_past_4_destinations[feature] = encoded_past_4_destinations[feature].astype(float)

        if self.model:
            encoded_prediction = self.model.predict([encoded_past_4_destinations.to_numpy().flatten()])[0]
        else:
            raise RuntimeError("Tried to infer while DestinationSuggestor model was not trained or loaded.")
        
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
        # print("Beginning data preparation and training...")
        suggestor.train(*suggestor.prep_data(args.train_data_manifest))

        # print("Saving the model...")
        os.makedirs('./bin', exist_ok=True)
        suggestor.save(args.model_filename)
    else:
        # print("Loading the model...")
        suggestor.load(args.model_filename)
        suggestor.retrieve_classes(args.train_data_manifest)

    # print("Performing inference...")
    classes_df = pd.read_csv(args.classes_filename)
    class_locations = { row['City'] + ", " + row['Country'] : { key : val for key, val in row.items() } for _, row in classes_df.iterrows() }
    class_location_list = [class_locations[key] for key in class_locations]

    if args.user_id:
        all_inferences = []
        all_locations_to_choose_from = make_graphql_request(query_filename="locations.graphql", variables={'user_id': args.user_id})['data']['locations']
        if len(all_locations_to_choose_from) < 4:
            all_locations_to_choose_from.insert(0, random.choices(class_location_list, weights=[idx + 1 for idx, _ in enumerate(class_location_list[::-1])], k=1)[0])
        for _ in range(args.num_recommendations):
            most_recent_locations = np.array(
                    [
                        location_json_to_list(location_json) for location_json
                          in random.choices(
                                all_locations_to_choose_from,
                                weights=[idx + 1 for idx, _ in enumerate(all_locations_to_choose_from)],
                                k=4
                              )
                    ]
                )
            most_recent_locations_df = pd.DataFrame(
                {
                    'Latitude' : most_recent_locations[:,0],
                    'Longitude' : most_recent_locations[:,1],
                    'Elevation' : most_recent_locations[:,2],
                    'AverageTemperature' : most_recent_locations[:,3],
                    'Trewartha' : most_recent_locations[:,4],
                    'ClimateZone' : most_recent_locations[:,5],
                }
            )
            for feature in ['Trewartha', 'ClimateZone']:
                most_recent_locations_df[feature] = encode(most_recent_locations_df, feature).astype(float)

            inference = class_locations[suggestor.infer(most_recent_locations_df)]
            if inference not in all_inferences:
                all_inferences.append(inference)

        print(str({"Prediction": all_inferences}).replace("'", '"'))
        return {"Prediction": all_inferences}
    else:
        return {"Error": "No user_id provided to utilize for inference."}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
            prog='model.py',
            description='Performs training based on the data in the specified csv.'
        )
    # Important args
    parser.add_argument('--train_data_manifest', default='./data/generated/master.csv')
    parser.add_argument('--user_id', default='655ac183d1028e5e0b01c52b')
    parser.add_argument('--num_recommendations', type=int, default=4)
    # Optional args
    parser.add_argument('--model_filename', default='./bin/dest_suggestor.pkl')
    parser.add_argument('--train', type=bool, default=False)
    parser.add_argument('--classes_filename', default='./data/classes.csv')
    args = parser.parse_args()
    main(args)
