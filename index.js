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

app.command("/dsb-catfact", async ({ ack, respond }) => {
  await ack();

  try {
    const response = await axios.get("https://catfact.ninja/fact");
    await respond({text: `Cat Fact:\n${response.data.fact}`});
  } catch (err) {
    console.log("Error in /dsb-catfact:\n" + err);
    await respond({text: `Failed to get a cat fact!`});
  }
});

app.command("/dsb-joke", async ({ ack, respond }) => {
  await ack();

  try {
    const response = await axios.get("https://official-joke-api.appspot.com/random_joke");
    await respond({
      text:
`${response.data.setup}

${response.data.punchline}`
    });
  } catch (err) {
    console.log("Error in /dsb-joke:\n" + err);
    await respond({ text: "Failed to fetch a joke." });
  }
});


app.command("/dsb-help", async ({ ack, respond }) => {
  await ack();
  await respond({
    text:
`Available Commands:
/dsb-ping - Check bot latency
/dsb-catfact - Get a cat fact`
  });
});


(async () => {
  await app.start();
  console.log('⚡️ Bolt app is running!');
})();