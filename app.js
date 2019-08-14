const express = require("express");
const { WebClient } = require("@slack/web-api");
const { createEventAdapter } = require("@slack/events-api");
const bodyParser = require('body-parser')

const app = express();
const port = process.env.PORT || 3000
const web = new WebClient(process.env.SLACK_TOKEN);
const slackEvents = createEventAdapter(process.env.SLACK_SIGNING_SECRET);
const urlencodedParser = bodyParser.urlencoded({ extended: false })


app.use("/slack/events", slackEvents.requestListener());

app.use(express.json());

const https = require('https');

// Put endpoints here
let returnString = '';
let data = '';

slackEvents.on("message", (event) => {
    if(event.channel_type === 'im' && event.text.toString().includes('potty')) {
        web.chat.postMessage({
            "channel": event.channel,
            "text": "Please select an office",
            "attachments": [
                {
                    "fallback": "Unable to choose an office",
                    "callback_id": "office_selector",
                    "color": "#3AA3E3",
                    "attachment_type": "default",
                    "actions": [
                        {
                            "name": "office_select",
                            "type": "select",
                            "text": "Select an office",
                            "options": [
                                {
                                    "text": "Gilbert",
                                    "value": "Gilbert"
                                },
                                {
                                    "text": "Scottsdale",
                                    "value": "Scottsdale"
                                },
                                {
                                    "text": "Tempe",
                                    "value": "Tempe"
                                }
                            ]
                        }
                    ]
                }
            ]
        });
    }
});


let subscribers = [];

app.post("/slack/actions", urlencodedParser, async (req, res) => {
    res.end();
    let json = JSON.parse(req.body.payload) // parse JSON
    console.log(json);
    if (json.callback_id !== 'office_selector') {


        console.log("**************");
        console.log(json);
        if (json.actions[0].value === "yeet") {
            console.log('yeet');
            subscribers.push(json.channel.id);
            console.log(subscribers);
            await web.chat.postMessage({
                "channel": json.channel.id,
                "text": "Great! We'll notify you when a bathroom becomes available."
            })
        } else {
            console.log('NOoooo yeet');
            await web.chat.postMessage({
                "channel": json.channel.id,
                "text": "Ok"
            })
        }
    } else{
        const conversationId = json.channel.id;
        (async () => {
            https.get('https://54e0356e.ngrok.io/api/potties?status=VACANT', (resp) => {
                let data = '';

                resp.on('data', (chunk) => {
                    data += chunk;
                });

                resp.on('end', () => {
                    returnString = (JSON.parse(data));
                    console.log(JSON.parse(data));
                    if(returnString.length > 0) {
                        let vacantList = returnString.map((list) => { return `${list.location} ${list.id}` });
                        const result = web.chat.postMessage({
                            text: 'The currently available bathrooms are: ' +
                                vacantList + '.',
                            channel: conversationId,

                        });
                        console.log(`Successfully send message ${result.ts} in conversation ${conversationId}`);
                    }
                    else
                        {
                            const result = web.chat.postMessage({
                                text: 'There are no currently available bathrooms. Do you wanna subscribe to getting updates on available bathrooms?',
                                attachments: [
                                    {
                                        "text": "Do you wanna subscribe to getting updates on available bathrooms?",
                                        "fallback": "You are unable to choose a game",
                                        "callback_id": "wopr_game",
                                        "color": "#3AA3E3",
                                        "attachment_type": "default",
                                        "actions": [
                                            {
                                                "name": "yes",
                                                "text": "Yes",
                                                "type": "button",
                                                "value": "yeet"
                                            },
                                            {
                                                "name": "no",
                                                "text": "No",
                                                "type": "button",
                                                "value": "nah",
                                            }

                                        ]
                                    }
                                ],
                                channel: conversationId,
                            });
                            console.log(`Successfully send message ${result.ts} in conversation ${conversationId}`);
                        }
                });

            }).on("error", (err) => {

            });
        })()
    }
});

// Endpoint that receives events from pottyapi
app.post("/events", urlencodedParser, (req, res) => {
    res.end(); // Sends HTTP 200 back to pottyapi
    let json = req.body;
    console.log(`Event received. Potty ${json.id} went from ${json.old_status} to ${json.current_status}`);
    subscribers.forEach((channelId) => {
        web.chat.postMessage({
            "channel": channelId,
            "text": `Bathroom ${json.location} ${json.id} is now ${json.current_status}`
        })
    });
    subscribers = [];
});


app.listen(port, () => {
    console.log(`pottybotty running on port ${port}`);
});
