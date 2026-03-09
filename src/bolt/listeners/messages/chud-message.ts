const response = await runAgent({
  text: message.text,
  slackClient: client,
  channel: message.channel,
  threadTs: message.thread_ts ?? message.ts,
});

await client.chat.postMessage({
  channel: message.channel,
  thread_ts: message.thread_ts ?? message.ts,
  text: response,
});