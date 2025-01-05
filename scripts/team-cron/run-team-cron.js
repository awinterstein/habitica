const mongoose = require("mongoose");
const nconf = require("nconf");

// Load config first
// nconf.file("config.json");

nconf.argv().env();

// Set defaults if not found in environment
nconf.defaults({
  SESSION_SECRET_KEY:
    "1234567891234567891234567891234567891234567891234567891234567891",
  SESSION_SECRET_IV: "12345678912345678912345678912345",
});

async function main() {
  try {
    // Connect to MongoDB and wait for connection (Not sure if this is really necessary)
    await mongoose.connect("mongodb://root-mongo-1:27017/habitica", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Connected to MongoDB");

    // Register babel after MongoDB connection
    require("@babel/register")({
      extensions: [".js"],
      presets: ["@babel/preset-env"],
      cache: false,
    });

    console.log("Babel registered");

    const processTeamsCron = require("./scripts/team-cron.js");

    if (typeof processTeamsCron !== "function") {
      throw new Error("processTeamsCron is not properly exported");
    }

    // Run the cron job
    console.log("Starting team cron processing...");
    await processTeamsCron();
    console.log("Team cron processing completed");
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    if (mongoose.connection) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

main().catch(console.error);
