const { loadConfig } = require('./config');
const { createApp } = require('./app');

const config = loadConfig();
const app = createApp(config);

app.listen(config.port, () => {
  console.log(`Server started on port ${config.port}`);
});
