import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { MongoClient, ObjectId } from 'mongodb';
import { FindUserByID } from './users';

const rpName = 'TourFusion';
const rpID = 'tour-fusion.com';
const origin = `https://${rpID}`;

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

// For items in the multifactor collection, the following format is used:
/*
{
    userId: ...,
    authenticators: [{...}],
    currentChallenge: "..."
}
*/

async function getUserFromDB(loggedInUserID) {
    return await FindUserByID(loggedInUserID);
}

async function getUserAuthenticators(user) {
    try {
        const db = client.db('geodb');
        const users = db.collection('multifactor');

        const user = await users.findOne({ "userId": user })
        if (!user) {
            return [];
        } else {
            return user.authenticators;
        }
    } catch (error) {
        console.log("Error getting current challenge:", error);
    }
    finally {
        await client.close();
    }
}

async function getUserAuthenticator(user, id) {
    const authens = await getUserAuthenticators(user);
    return authens.find((e) => e.credentialID == id)
}

async function setUserCurrentChallenge(user, challenge) {
    try {
        const db = client.db('geodb');
        const users = db.collection('multifactor');

        const coreDocumentExists = await users.findOne({ "userId": user })
        if (!coreDocumentExists) {
            await users.insertOne({
                "userId": user,
                "authenticators": [],
                "currentChallenge": challenge
            });

            return;
        } else {
            await users.updateOne(
                { "userId": user },
                { "$set": { "currentChallenge": challenge } }
            )
        }
    } catch (error) {
        console.log("Error adding user:", error);
    }
    finally {
        await client.close();
    }
}

async function getUserCurrentChallenge(user) {
    try {
        const db = client.db('geodb');
        const users = db.collection('multifactor');

        const user = await users.findOne({ "userId": user })
        if (!user) {
            return null;
        } else {
            return user.currentChallenge;
        }
    } catch (error) {
        console.log("Error getting current challenge:", error);
    }
    finally {
        await client.close();
    }
}

async function saveNewUserAuthenticatorInDB(user, newAuthenticator) {
    try {
        const db = client.db('geodb');
        const users = db.collection('multifactor');

        const coreDocumentExists = await users.findOne({ "userId": user })
        if (!coreDocumentExists) {
            await users.insertOne({
                "userId": user,
                "authenticators": [newAuthenticator],
                "currentChallenge": ""
            });

            return;
        }

        const exists = await users.findOne({
            $and: [
                { "userId": user },
                {
                    "authenticators": {
                        '$elemMatch': {
                            "credentialID": newAuthenticator.credentialID
                        }
                    }
                }
            ]
        });
        if (exists) {
            throw new Error('User already exists');
        } else {
            await users.insertOne(newAuthenticator);
        }
    } catch (error) {
        console.log("Error adding user:", error);
    }
    finally {
        await client.close();
    }
}

async function getRegistrationOptions(req, res) {
    const user = await getUserFromDB(loggedInUserId);
    const userAuthenticators = await getUserAuthenticators(user);

    const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: user._id,
        userName: user.email,
        attestationType: 'none',
        // Prevent users from re-registering existing authenticators
        excludeCredentials: userAuthenticators.map(authenticator => ({
            id: authenticator.credentialID,
            type: 'public-key',
            transports: authenticator.transports,
        })),
        authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'discouraged',
            authenticatorAttachment: 'platform',
        },
    });

    await setUserCurrentChallenge(user, options.challenge);
    res.status(200).json(options);
}

async function verifyAndSaveRegistration(req, res) {
    const { body } = req;

    const user = await getUserFromDB(loggedInUserId);
    const expectedChallenge = await getUserCurrentChallenge(user);

    let verification;
    try {
        verification = await verifyRegistrationResponse({
            response: body,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
        });
    } catch (error) {
        console.error(error);
        return res.status(400).send({ error: error.message });
    }

    const { verified } = verification;
    if (verified) {
        const { registrationInfo } = verification;
        const {
            credentialPublicKey,
            credentialID,
            counter,
            credentialDeviceType,
            credentialBackedUp,
            transports,
        } = registrationInfo;

        const newAuthenticator = {
            credentialID,
            credentialPublicKey,
            counter,
            credentialDeviceType,
            credentialBackedUp,
            transports,
        };

       await saveNewUserAuthenticatorInDB(user, newAuthenticator);
    }

    res.status(200).json({ verified });
}

async function getAuthenticationOptions(req, res) {
    const user = await getUserFromDB(loggedInUserId); // TODO
    const userAuthenticators = await getUserAuthenticators(user);

    const options = await generateAuthenticationOptions({
        rpID,
        // Require users to use a previously-registered authenticator
        allowCredentials: userAuthenticators.map(authenticator => ({
            id: authenticator.credentialID,
            type: 'public-key',
            transports: authenticator.transports,
        })),
        userVerification: 'preferred',
    });

    setUserCurrentChallenge(user, options.challenge);
    res.status(200).json(options);
}

async function verifyAuthentication(req, res) {
    const { body } = req;

    const user = await getUserFromDB(loggedInUserId);
    const expectedChallenge = getUserCurrentChallenge(user);
    const authenticator = getUserAuthenticator(user, body.id);

    if (!authenticator) {
        throw new Error(`Could not find authenticator ${body.id} for user ${user.id}`);
    }

    let verification;
    try {
        verification = await verifyAuthenticationResponse({
            response: body,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            authenticator,
        });
    } catch (error) {
        console.error(error);
        return res.status(400).json({ error: error.message });
    }

    const { verified } = verification;
    if (verified) {
        const { authenticationInfo } = verification;
        const { newCounter } = authenticationInfo;

        saveUpdatedAuthenticatorCounter(authenticator, newCounter);
    }

    res.status(200).json({ verified });
}

export {
    getRegistrationOptions,
    getAuthenticationOptions,
    verifyAndSaveRegistration,
    verifyAuthentication
}
