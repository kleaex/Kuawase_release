const path = require("path");
const { createRequire } = require("module");

function getPrototypeSourceRepo() {
  const sourceRepo = process.env.KUAWASE_PROTOTYPE_SOURCE_REPO;

  if (!sourceRepo) {
    throw new Error("KUAWASE_PROTOTYPE_SOURCE_REPO is not set.");
  }

  return sourceRepo;
}

function createPrototypeRequire() {
  const sourceRepo = getPrototypeSourceRepo();
  return createRequire(path.join(sourceRepo, "package.json"));
}

function loadPrototypeDependencies() {
  const prototypeRequire = createPrototypeRequire();

  return {
    autoUpdater: prototypeRequire("electron-updater").autoUpdater,
    log: prototypeRequire("electron-log"),
    remoteMain: prototypeRequire("@electron/remote/main"),
    axios: prototypeRequire("axios"),
    xlsx: prototypeRequire("xlsx")
  };
}

module.exports = {
  createPrototypeRequire,
  getPrototypeSourceRepo,
  loadPrototypeDependencies
};
