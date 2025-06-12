const express = require('express');
const fs = require('fs');
const dotenv = require('dotenv');
const { Vonage } = require('@vonage/server-sdk');
const { verifySignature } = require('@vonage/jwt');

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const VONAGE_API_SIGNATURE_SECRET = process.env.VONAGE_API_SIGNATURE_SECRET;

const privateKey = fs.readFileSync(process.env.VONAGE_PRIVATE_KEY);

const vonage = new Vonage({
  applicationId: process.env.VONAGE_APPLICATION_ID,
  privateKey: privateKey
});

app.post('/send-standalone-rich-card', async (req, res) => {
  const toNumber = req.body.to;

  const message = {
    to: toNumber,
    from: process.env.RCS_SENDER_ID,
    channel: 'rcs',
    message_type: 'custom', // Required for sending rich cards
    custom: {
      contentMessage: {
        richCard: {
          standaloneCard: {
            thumbnailImageAlignment: "RIGHT", // Aligns image on the right in horizontal layouts
            cardOrientation: "VERTICAL", // Stack elements vertically
            cardContent: {
              title: "Meet our office puppy!", // Main headline for the card
              description: "What would you like to do next?", // Secondary text to provide context
              media: {
                height: "TALL", // Height options: SHORT, MEDIUM, TALL
                contentInfo: {
                  fileUrl: "https://raw.githubusercontent.com/Vonage-Community/tutorial-messages-node-rcs_standalone-rich-card/refs/heads/main/puppy_dev.gif",
                  forceRefresh: false // Set to true if media changes often
                }
              },
              suggestions: [
                { reply: { text: "Pet the puppy", postbackData: "pet_puppy" } },
                { reply: { text: "Give a treat", postbackData: "give_treat" } },
                { reply: { text: "Take a selfie", postbackData: "take_selfie" } },
                { reply: { text: "Adopt me!", postbackData: "adopt_puppy" } }
              ]
            }
          }
        }
      }
    }
  };

  try {
    const response = await vonage.messages.send(message);
    console.log('Standalone rich card sent:', response);
    res.status(200).json({ message: 'Standalone rich card sent successfully.' });
  } catch (error) {
    console.error('Error sending standalone rich card:', error);
    res.status(500).json({ error: 'Failed to send standalone rich card.' });
  }
});

app.post('/inbound_rcs', async (req, res) => {

  // Step 1: Extract and verify the JWT signature
  const token = req.headers.authorization?.split(' ')[1];

  if (!verifySignature(token, VONAGE_API_SIGNATURE_SECRET)) {
    res.status(401).end();
    return;
  }

  // Step 2: Parse the inbound message payload
  const inboundMessage = req.body;

  if (inboundMessage.channel === 'rcs' && inboundMessage.message_type === 'reply') {
    const userSelection = inboundMessage.reply.id;
    const userNumber = inboundMessage.from;

    console.log(`User ${userNumber} selected: ${userSelection}`);

    // Step 3: Map each reply ID to a personalized confirmation
    const responseMessages = {
      pet_puppy: "🐶 Oscar loves pets!",
      give_treat: "🍪 Treat accepted! Oscar is wagging his tail.",
      take_selfie: "📸 Smile! Oscar’s photogenic and ready.",
      adopt_puppy: "Wow! Oscar is so lucky! You're a real hero 🦸"
    };

    const confirmationText =
      responseMessages[userSelection] || "Oscar appreciates the love! 🐾";

    // Step 4: Send a confirmation message back to the user
    const confirmationMessage = {
      to: userNumber,
      from: process.env.RCS_SENDER_ID,
      channel: 'rcs',
      message_type: 'text',
      text: confirmationText
    };

    try {
      const response = await vonage.messages.send(confirmationMessage);
      console.log('Confirmation sent:', response);
    } catch (error) {
      console.error('Error sending confirmation:', error);
    }
  }

  res.status(200).end();
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
