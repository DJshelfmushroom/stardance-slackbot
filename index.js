require('dotenv').config();

const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs');
const { App } = require('@slack/bolt');

// #region schemas
const schedule_message_schema = {
	"blocks": [
		{
			"type": "input",
			"element": {
				"type": "plain_text_input",
				"action_id": "number_input_action"
			},
			"label": {
				"type": "plain_text",
				"text": "Number",
				"emoji": true
			},
			"block_id": "number_input_block"
		},
		{
			"type": "input",
			"element": {
				"type": "static_select",
				"action_id": "interval_select_action",
				"placeholder": {
					"type": "plain_text",
					"text": "Select an item",
					"emoji": true
				},
				"options": [
					{
						"text": {
							"type": "plain_text",
							"text": "Minutes",
							"emoji": true
						},
						"value": "minutes"
					},
					{
						"text": {
							"type": "plain_text",
							"text": "Hours",
							"emoji": true
						},
						"value": "hours"
					},
					{
						"text": {
							"type": "plain_text",
							"text": "Days",
							"emoji": true
						},
						"value": "days"
					}
				]
			},
			"label": {
				"type": "plain_text",
				"text": "Interval",
				"emoji": true
			},
			"block_id": "interval_select_block"
		},
		{
			"type": "input",
			"element": {
				"type": "timepicker",
				"action_id": "start_time_action",
				"initial_time": "13:37",
				"placeholder": {
					"type": "plain_text",
					"text": "Select time",
					"emoji": true
				}
			},
			"label": {
				"type": "plain_text",
				"text": "Starting at",
				"emoji": true
			},
			"block_id": "start_time_block"
		},
		{
			"type": "input",
			"element": {
				"type": "datepicker",
				"action_id": "start_date_action",
				"initial_date": new Date().toISOString().slice(0,10),
				"placeholder": {
					"type": "plain_text",
					"text": "Select a date",
					"emoji": true
				}
			},
			"label": {
				"type": "plain_text",
				"text": "On",
				"emoji": true
			},
			"block_id": "start_date_block"
		},
	]
};
const schedule_modal_view_schema = {
	"type": "modal",
	"callback_id": "schedule_modal_view",
	"title": {
		"type": "plain_text",
		"text": "Schedule your cat images",
		"emoji": true
	},
	"submit": {
		"type": "plain_text",
		"text": "Submit",
		"emoji": true
	},
	"close": {
		"type": "plain_text",
		"text": "Cancel",
		"emoji": true
	},
	"blocks": schedule_message_schema.blocks
};
// #endregion

const subscribers = fs.existsSync('subscribers.json') ? JSON.parse(fs.readFileSync('subscribers.json')) : {};

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
    const catUrl = await getCatImageUrl();
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
            "image_url": catUrl,
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
/djb-subscribe - Schedule recurring cat images
/djb-unsubscribe - Cancel scheduled cat images
`
  });
});

// #region subscription
app.command("/djb-subscribe", async ({ ack, body, respond }) => {
  await ack();
  try {
    const res = await app.client.views.open({
      trigger_id: body.trigger_id,
      view: schedule_modal_view_schema,
    });
    console.log(res);
  } catch(error) {
    console.log("Error opening modal", error);
    await respond({text: "Failed to open the scheduler, please try again!", response_type: "ephemeral"});
  }
});

app.view("schedule_modal_view", async ({ ack, view, body }) => {
  await ack();
  const submittedValues = parseStateValues(view.state.values);
  console.log("Form submitted with values:", submittedValues);

  const userTZ = await app.client.users.info({user: body.user.id}).then(res => res.user.tz);
  console.log("User timezone:", userTZ);

  const userOffsetMins = getOffsetBetweenTimezones(userTZ, "UTC", new Date());
  const tzSign = userOffsetMins >= 0 ? '+' : '-';
  const tzHours = Math.abs(Math.trunc(userOffsetMins / 60)).toString().padStart(2, '0');
  const tzMins = Math.abs(userOffsetMins % 60).toString().padStart(2, '0');
  const tzString = `${tzSign}${tzHours}:${tzMins}`;

  const scheduledDate = submittedValues['start_date_action'];
  const scheduledTime = submittedValues['start_time_action'];

  const timeToSchedule = new Date(`${scheduledDate}T${scheduledTime}:00.000${tzString}`);
  console.log("Time/date to schedule:", timeToSchedule.toLocaleString());

  subscribers[body.user.id] = {
    interval: submittedValues['interval_select_action'],
    number: submittedValues['number_input_action'],
    nextScheduledTime: timeToSchedule.toISOString(),
  };
  fs.writeFileSync('subscribers.json', JSON.stringify(subscribers, null, 2));
});
// #endregion

app.command("/djb-unsubscribe", async ({ ack, body, respond }) => {
  await ack();
  console.log(body);
  if(subscribers[body.user_id]){
    delete subscribers[body.user_id];
    fs.writeFileSync('subscribers.json', JSON.stringify(subscribers, null, 2));
    await respond({text: "You have been unsubscribed from scheduled cat images.", response_type: "ephemeral"});
  } else {
    await respond({text: "You are not currently subscribed to scheduled cat images.", response_type: "ephemeral"});
  }
});

(async () => {
  await app.start();
  console.log('⚡️ Bolt app is running!');
  cron.schedule('* * * * *', async () => {
    console.log("Date:", new Date().toLocaleString());
    for(const userID in subscribers){
      const scheduledTime = new Date(subscribers[userID].nextScheduledTime);
      const now = new Date();
      if (scheduledTime.getFullYear() === now.getFullYear() &&
        scheduledTime.getMonth() === now.getMonth() &&
        scheduledTime.getDate() === now.getDate() &&
        scheduledTime.getHours() === now.getHours() &&
        scheduledTime.getMinutes() === now.getMinutes()){
        const catUrl = await getCatImageUrl();
        await app.client.chat.postMessage({
          channel: userID,
          text: "Here's your scheduled cat image!",
          blocks: [
            {
              "type": "section",
              "text": {
                "type": "mrkdwn",
                "text": "Here's your cat! :cat:"
              }
            },
            {
              "type": "image",
              "image_url": catUrl,
              "alt_text": "a cat"
            }
          ]
        });
        const interval = subscribers[userID].interval;
        const number = parseInt(subscribers[userID].number) || 1;

        if(interval === "minutes"){
          scheduledTime.setMinutes(scheduledTime.getMinutes() + number);
        } else if(interval === "hours"){
          scheduledTime.setHours(scheduledTime.getHours() + number);
        } else if(interval === "days"){
          scheduledTime.setDate(scheduledTime.getDate() + number);
        }
        subscribers[userID].nextScheduledTime = scheduledTime.toISOString();
        fs.writeFileSync('subscribers.json', JSON.stringify(subscribers, null, 2));
      }
    }
  });
})();


function getOffsetBetweenTimezones(tz1, tz2, date = new Date()) {
  const getZoneUtcTimestamp = (timeZone) => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    });

    const parts = formatter.formatToParts(date).reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

    return Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour === '24' ? 0 : parts.hour,
      parts.minute,
      parts.second
    );
  };

  const tz1Ms = getZoneUtcTimestamp(tz1);
  const tz2Ms = getZoneUtcTimestamp(tz2);

  return (tz1Ms - tz2Ms) / (1000 * 60);
}

function parseStateValues(stateValues = {}) {
  let parsed = {};

  for(const id in stateValues) {
    const action = stateValues[id];
    for(const actionId in action) {
      const value = action[actionId];
      if(value.type === "plain_text_input") {
        parsed[actionId] = value.value;
      } else if(value.type === "static_select") {
        parsed[actionId] = value.selected_option?.value ?? null;
      } else if(value.type === "timepicker") {
        parsed[actionId] = value.selected_time;
      } else if(value.type === "datepicker") {
        parsed[actionId] = value.selected_date;
      }
    }
  }

  return parsed;
}

function getCatImageUrl() {
  return axios.get("https://api.thecatapi.com/v1/images/search", {
    headers: { "x-api-key": process.env.CAT_API_KEY }
  }).then(response => response.data[0].url);
}
