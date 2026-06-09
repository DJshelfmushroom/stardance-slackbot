require('dotenv').config();

const axios = require('axios');
const { App } = require('@slack/bolt');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

app.command("/djb-ping", async({command, ack, respond}) => {
  const start = Date.now();
  await ack();
  const latency = Date.now() - start;
  await respond(`Pong! Latency: ${latency}ms`);
});

app.command("/djb-catfact", async ({ ack, respond }) => {
  await ack();

  try {
    const response = await axios.get("https://catfact.ninja/fact");
    await respond({text: `Cat Fact:\n${response.data.fact}`});
  } catch (err) {
    console.log("Error in /djb-catfact:\n" + err);
    await respond({text: `Failed to get a cat fact!`});
  }
});

app.command("/djb-joke", async ({ ack, respond }) => {
  await ack();

  try {
    const response = await axios.get("https://official-joke-api.appspot.com/random_joke");
    await respond({
      text:
`${response.data.setup}

${response.data.punchline}`
    });
  } catch (err) {
    console.log("Error in /djb-joke:\n" + err);
    await respond({ text: "Failed to fetch a joke." });
  }
});

app.command("/djb-catimg", async ({ack, respond}) => {
  await ack();
  try {
    let resp = await respond({text: "Working...", response_type: "ephemeral"});
    console.log(resp.request);
    const response = await axios.get("https://api.thecatapi.com/v1/images/search");
    await respond(
      {
        "blocks": [
          {
            "type": "rich_text",
            "elements": [
              {
                "type": "rich_text_section",
                "elements": [
                  {
                    "type": "text",
                    "text": "Here's your cat image:"
                  }
                ]
              }
            ]
          },
          {
            "type": "image",
            "image_url": response.data[0].url,
            "alt_text": "cat"
          }/*,
          {
          // Nothing here for now, maybe add some voting buttons later?
            "type": "actions",
            "elements": [
              {
                "type": "button",
                "style": "primary",
                "text": {
                  "type": "plain_text",
                  "text": "👍",
                  "emoji": true
                },
                "value": "click_me_123",
                "action_id": "actionId-0"
              },
              {
                "type": "button",
                "style": "danger",
                "text": {
                  "type": "plain_text",
                  "text": "👎",
                  "emoji": true
                },
                "value": "click_me_123",
                "action_id": "actionId-1"
              }
            ]
          }*/
        ],
        replace_original: true
});
  } catch (err) {
    console.log("Error in /djb-catimg:\n" + err);
    await respond({text: `Failed to get a cat image!`});
  }
});

app.command("/djb-help", async ({ ack, respond }) => {
  await ack();
  await respond({
    text:
`Available Commands:
/djb-ping - Check bot latency
/djb-catimg - Get a random cat image
/djb-catfact - Get a cat fact
/djb-joke - Get a joke
`
  });
});


(async () => {
  await app.start();
  console.log('⚡️ Bolt app is running!');
})();