import { MongoClient, ObjectId } from "mongodb";
import {
  getAverageTemperature,
  getClimate,
  getElevation,
  getPopulationDensity,
  mapLocationGraphQLToMongo,
  mapLocationMongoToGraphQL,
  recommendLocs,
} from "./helper.js";
import "./loadenv.js";

const uri = process.env.MONGO_URI;
const client = new MongoClient(
  uri,
  { useUnifiedTopology: true },
  { useNewUrlParser: true },
  { connectTimeoutMS: 30000 },
  { keepAlive: 1 }
);

let locationsArr, location;

export const addLocation = async function (user_id, name, latitude, longitude) {
  try {
    const db = client.db("geodb");
    const locations = db.collection("locations");

    // Define a 2dsphere geospatial index on the 'location' field
    await locations.createIndex({ location: "2dsphere" });

    location = await locations.findOne({
      $and: [
        { user_id: user_id },
        {
          location: {
            $nearSphere: {
              $geometry: {
                type: "Point",
                coordinates: [longitude, latitude],
              },
              $maxDistance: 5000, // 5 km radius for same place flagging
            },
          },
        },
      ],
    });

    if (location) {
      throw new Error("Close by Location already added");
    } else {
      const elevation = await getElevation(latitude, longitude);
      // const population_density = await getPopulationDensity(latitude, longitude);
      const avg_temp = await getAverageTemperature(latitude, longitude);
      const climate = await getClimate(latitude, longitude);

      const query = {
        user_id: user_id,
        name: name,
        location: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        elevation: elevation,
        // "population_density": population_density,
        avg_temp: avg_temp,
        trewartha: climate[0],
        climate_zone: climate[1],
      };
      await locations.insertOne(query);
      return "Success";
    }
  } catch (error) {
    console.error("Error adding location", error);
    return "Failure!";
  } finally {
    // await client.close();
  }
};

export const QueryLocations = async (user_id) => {
  try {
    const db = client.db("geodb");
    const locations = db.collection("locations");

    const query = await locations.find({ user_id }).toArray();

    //* Mapping the data to the specific graphQL shape since mongodb points don't convert to
    //* a graphQL Object
    locationsArr = mapLocationMongoToGraphQL(query);

    return locationsArr;
  } catch (error) {
    console.error(error);
  }
};

//! Under Construction, will do later
export const QueryLocationsByName = async (user_id, name) => {
  try {
    const db = client.db("geodb");
    const locations = db.collection("locations");

    const query = {};
    query["name"] = new RegExp(name, "i");

    const mongo_query = await locations
      .find({ $and: [{ user_id: user_id }, query] })
      .toArray();
    locationsArr = mapLocationMongoToGraphQL(mongo_query);
  } catch (error) {
    console.error(error);
  } finally {
    return locationsArr;
  }
};

export const UpdateLocation = async (_id, updatedData) => {
  try {
    const db = client.db("geodb");
    const locations = db.collection("locations");

    const oldLocation = await locations.findOne({ _id: new ObjectId(_id) });

    // set name to old name if name is not provided
    if (!updatedData.name) {
      updatedData.name = oldLocation.name;
    }

    let elevation = oldLocation.elevation;
    let avg_temp = oldLocation.avg_temp;
    let climate = [oldLocation.trewartha, oldLocation.climate_zone];
    let latitude = oldLocation.location.coordinates[1];
    let longitude = oldLocation.location.coordinates[0];

    // console.log(latitude, longitude, updatedData.name);

    // only go along with this if location is provided
    if (updatedData.location) {
      latitude = updatedData.location.latitude;
      longitude = updatedData.location.longitude;

      // only get data from apis if coords changed
      if (
        latitude != oldLocation.location.coordinates[1] ||
        longitude != oldLocation.location.coordinates[0]
      ) {
        elevation = await getElevation(latitude, longitude);
        avg_temp = await getAverageTemperature(latitude, longitude);
        climate = await getClimate(latitude, longitude);
      }
    }

    updatedData.location = {};
    updatedData.location.longitude = longitude;
    updatedData.location.latitude = latitude;
    updatedData.elevation = elevation;
    updatedData.avg_temp = avg_temp;
    updatedData.trewartha = climate[0];
    updatedData.climate_zone = climate[1];

    const updatedLocation = mapLocationGraphQLToMongo(updatedData);

    location = await locations.findOneAndUpdate(
      { _id: new ObjectId(_id) },
      { $set: updatedLocation },
      { returnDocument: "after" }
    );
  } catch (error) {
    console.error(error);
  } finally {
    return location;
  }
};

export const DeleteLocation = async (_id) => {
  try {
    const db = client.db("geodb");
    const locations = db.collection("locations");

    location = await locations.deleteOne({ _id: new ObjectId(_id) });
    location = location.deletedCount > 0 ? "Success" : "Failure";
  } catch (error) {
    console.error(error);
  } finally {
    return location;
  }
};

export const RecommendLocations = async (user_id, num_recommendations) => {
  try {
    const res = await recommendLocs(user_id, num_recommendations);
    console.log(res);
    return res;
  } catch (err) {
    console.error(err);
  }
  return [];
};
