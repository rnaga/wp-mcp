#!/usr/bin/env node

import { Clis } from "@rnaga/wp-node-cli/clis";

import { UtilsCli } from "./utils.cli";
import { LocalCli } from "./local.cli";
import { HttpCli } from "./http.cli";
import { RemoteCli } from "./remote.cli";

Clis.unregisterAll();
Clis.register([LocalCli, UtilsCli, HttpCli, RemoteCli]);

(async () => {
  await Clis.executeCommand(process.argv);
})();
