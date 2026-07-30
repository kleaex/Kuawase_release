const fs = require("fs");
const path = require("path");

function copyDirectory(source, destination, options = {}) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (options.excludeOut && entry.name === "out") continue;
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destinationPath, options);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

function resolvePackageJson(packageName, basedir) {
  return require.resolve(path.join(packageName, "package.json"), {
    paths: [basedir]
  });
}

function getNodeModuleDestination(buildPath, packageName) {
  const parts = packageName.split("/");
  return path.join(buildPath, "node_modules", ...parts);
}

function copyRuntimePackage(packageName, buildPath, basedir, seen = new Set()) {
  if (seen.has(packageName)) return;
  seen.add(packageName);

  let packageJsonPath;
  try {
    packageJsonPath = resolvePackageJson(packageName, basedir);
  } catch (error) {
    if (error.code === "MODULE_NOT_FOUND") return;
    throw error;
  }

  const packageRoot = path.dirname(packageJsonPath);
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  copyDirectory(packageRoot, getNodeModuleDestination(buildPath, packageName));

  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.optionalDependencies
  };
  for (const dependencyName of Object.keys(dependencies)) {
    copyRuntimePackage(dependencyName, buildPath, basedir, seen);
  }
}

function copyRuntimeDependencies(buildPath) {
  const basedir = path.resolve(__dirname, "../../..");
  for (const packageName of ["@electron/remote", "axios", "dompurify", "electron-log", "electron-updater", "xlsx"]) {
    copyRuntimePackage(packageName, buildPath, basedir);
  }
}

function materializeCoreCssImports(buildPath) {
  const coreCssDir = path.resolve(__dirname, "renderer", "css");
  const appCssDir = path.join(buildPath, "css");
  if (!fs.existsSync(coreCssDir) || !fs.existsSync(appCssDir)) return;

  for (const entry of fs.readdirSync(coreCssDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      copyDirectory(path.join(coreCssDir, entry.name), path.join(appCssDir, entry.name));
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".css")) continue;
    const destination = path.join(appCssDir, entry.name);
    if (!fs.existsSync(destination)) {
      fs.copyFileSync(path.join(coreCssDir, entry.name), destination);
      continue;
    }

    const existing = fs.readFileSync(destination, "utf8").trim();
    const coreImport = `@import url("../../../packages/kuawase-core/src/renderer/css/${entry.name}");`;
    if (existing === coreImport) {
      fs.copyFileSync(path.join(coreCssDir, entry.name), destination);
    } else if (existing.includes(coreImport)) {
      fs.writeFileSync(
        destination,
        fs.readFileSync(destination, "utf8").replaceAll(
          coreImport,
          `@import url("../packages/kuawase-core/src/renderer/css/${entry.name}");`
        ),
        "utf8"
      );
    }
  }
}

function createForgeConfig(product, options = {}) {
  const executableBaseName = product.forge.executableName.replace(/\.exe$/i, "");
  const setupExecutableName = options.packageVersion
    ? `${product.displayName}-${options.packageVersion}.exe`
    : (product.forge.setupExecutableName || `${product.displayName}-setup.exe`);

  return {
    packagerConfig: {
      asar: true,
      executableName: executableBaseName
    },
    hooks: {
      packageAfterCopy: async (_forgeConfig, buildPath) => {
        const coreRoot = path.resolve(__dirname, "..");
        copyDirectory(coreRoot, path.join(buildPath, "packages", "kuawase-core"), { excludeOut: true });
        materializeCoreCssImports(buildPath);
      },
      packageAfterPrune: async (_forgeConfig, buildPath) => {
        copyRuntimeDependencies(buildPath);
      }
    },
    rebuildConfig: {},
    makers: [
      {
        name: "@electron-forge/maker-squirrel",
        config: {
          name: product.displayName,
          authors: product.author,
          exe: product.forge.executableName,
          setupExe: setupExecutableName,
          description: product.description,
          iconUrl: product.forge.iconUrl,
          noMsi: true,
          licenseUrl: product.forge.licenseUrl
        }
      },
      {
        name: "@electron-forge/maker-zip",
        platforms: ["darwin"]
      },
      {
        name: "@electron-forge/maker-deb",
        config: {}
      },
      {
        name: "@electron-forge/maker-rpm",
        config: {}
      }
    ],
    publishers: [
      {
        name: "@electron-forge/publisher-github",
        config: {
          repository: product.forge.publisherRepository,
          prerelease: false,
          draft: true
        }
      }
    ]
  };
}

module.exports = {
  createForgeConfig
};
