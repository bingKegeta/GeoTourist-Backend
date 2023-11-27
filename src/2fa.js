import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from '@simplewebauthn/server';

const rpName = 'TourFusion';
const rpID = 'tour-fusion.com';
const origin = `https://${rpID}`;

function getUserFromDB(loggedInUserID) {

}

function getUserAuthenticators(user) {

}

function getUserAuthenticator(user, id) {
    
}

function setUserCurrentChallenge(user, challenge) {

}

function getUserCurrentChallenge(user) {

}

function saveNewUserAuthenticatorInDB(user, newAuthenticator) {

}

async function getRegistrationOptions(req, res) {
    const user = getUserFromDB(loggedInUserId);
    const userAuthenticators = getUserAuthenticators(user);

    const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: user.id,
        userName: user.username,
        attestationType: 'none',
        // Prevent users from re-registering existing authenticators
        excludeCredentials: userAuthenticators.map(authenticator => ({
            id: authenticator.credentialID,
            type: 'public-key',
            // transports: authenticator.transports,
        })),
        authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'discouraged',
            authenticatorAttachment: 'platform',
        },
    });

    // (Pseudocode) Remember the challenge for this user
    setUserCurrentChallenge(user, options.challenge); // TODO

    res.status(200).json(options);
}

async function verifyAndSaveRegistration(req, res) {
    const { body } = req;

    const user = getUserFromDB(loggedInUserId);
    const expectedChallenge = getUserCurrentChallenge(user);

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

        saveNewUserAuthenticatorInDB(user, newAuthenticator);
    }

    res.status(200).json({ verified });
}

async function getAuthenticationOptions(req, res) {
    const user = getUserFromDB(loggedInUserId); // TODO
    const userAuthenticators  = getUserAuthenticators(user);

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

    const user = getUserFromDB(loggedInUserId);
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
