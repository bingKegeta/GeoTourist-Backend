import { MongoClient, ObjectId } from "mongodb";
import bcrypt from "bcrypt";
import { generateAuthToken } from "./helper.js";
import "./loadenv.js";

// the closing of the connection is moved to an unreachable section since it wasn't working for some reason previously
//! It's definitely bad practice that we're going to make better

const uri = process.env.MONGO_URI;
const client = new MongoClient(
  uri,
  { useUnifiedTopology: true },
  { useNewUrlParser: true },
  { connectTimeoutMS: 30000 },
  { keepAlive: 1 }
);
const SALT_ROUNDS = 16;
const emailRegex = new RegExp(
  /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/
);
let usersArr, user, newUser;

export const QueryUsers = async function () {
  try {
    const db = client.db("geodb");
    const users = db.collection("users");
    usersArr = await users.find({}).toArray();
  } finally {
    return usersArr;
  }
  await client.close();
};

export const FindUser = async function (email, username) {
  try {
    const db = client.db("geodb");
    const users = db.collection("users");

    const query = {
      email: new RegExp("^" + email + "$"),
      username: new RegExp("^" + username + "$"),
    };

    user = await users.findOne(query);
  } finally {
    return user;
  }
  await client.close();
};

export const FindUsersByField = async function (field, value) {
  try {
    const db = client.db("geodb");
    const usersCollection = db.collection("users");

    if (field == "password") {
      throw new Error("Cannot search by password");
    }

    const query = {};
    query[field] = new RegExp(value, "i"); // Use case-insensitive regex for partial matches

    usersArr = await usersCollection.find(query).toArray();
  } catch (error) {
    console.error("Error finding users:", error);
  } finally {
    return usersArr;
  }
  await client.close();
};

export const FindUserByID = async function (_id) {
  try {
    const db = client.db("geodb");
    const users = db.collection("users");

    user = await users.findOne(new ObjectId(_id));
  } catch (error) {
    console.error("Unable to find user with input id", error);
  } finally {
    return user;
  }
};

export const AddUser = async function (email, username, password) {
  try {
    const db = client.db("geodb");
    const users = db.collection("users");

    const emailValid = emailRegex.test(email);
    if (!emailValid) {
      newUser = null;
      throw new Error("Email is not of valid format");
    }

    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hash = await bcrypt.hash(password, salt);

    const doc = {
      email: email,
      username: username,
      password: hash,
    };

    const exists = await users.findOne({
      $or: [{ email: doc.email }, { username: doc.username }],
    });
    if (exists) {
      newUser = null;
      throw new Error("User already exists");
    } else {
      doc._id = (await users.insertOne(doc)).insertedId;
      newUser = doc;
    }
  } catch (error) {
    console.log("Error adding user:", error);
  } finally {
    if (newUser) {
      return generateAuthToken(newUser);
    } else {
      return newUser;
    }
  }
  await client.close();
};

export const Login = async function (emailOrUsername, password) {
  try {
    const db = client.db("geodb");
    const usersCollection = db.collection("users");

    // Find the user by email or username
    user = await usersCollection.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }],
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Check if the provided password matches the stored password (you should use a secure method like bcrypt for this)
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new Error("Invalid password");
    }

    // Generate and return an authentication token (you would use a secure method for this)
    const authToken = generateAuthToken(user);

    return authToken;
  } catch (error) {
    console.error("Login error:", error);
    throw error; // Rethrow the error
  } finally {
  }
  await client.close();
};
