import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
} from '@simplewebauthn/server';

const rpName = 'TourFusion';
const rpID = 'tour-fusion.com';
const origin = `https://${rpID}`;

async function getRegistrationOptions() {
    // (Pseudocode) Retrieve the user from the database
    // after they've logged in
    const user = getUserFromDB(loggedInUserId); // TODO
    // (Pseudocode) Retrieve any of the user's previously-
    // registered authenticators
    const userAuthenticators = getUserAuthenticators(user); // TODO

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
            // Optional
            // transports: authenticator.transports,
        })),
        // See "Guiding use of authenticators via authenticatorSelection" below
        authenticatorSelection: {
            // Defaults
            residentKey: 'preferred',
            userVerification: 'discouraged',
            // Optional
            authenticatorAttachment: 'platform',
        },
    });

    // (Pseudocode) Remember the challenge for this user
    setUserCurrentChallenge(user, options.challenge); // TODO

    return options;
}

async function verifyAndSaveRegistration() {
    const { body } = req;

    // (Pseudocode) Retrieve the logged-in user
    const user = getUserFromDB(loggedInUserId); // TODO
    // (Pseudocode) Get `options.challenge` that was saved above
    const expectedChallenge = getUserCurrentChallenge(user); // TODO

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

        // (Pseudocode) Save the authenticator info so that we can
        // get it by user ID later
        saveNewUserAuthenticatorInDB(user, newAuthenticator); // TODO
    }

    return { verified };
}
