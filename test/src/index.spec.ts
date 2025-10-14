import Application from "@rnaga/wp-node/application";
import { Current } from "@rnaga/wp-node/core/current";

test("switching site", async () => {
  const context = await Application.getContext("multi");
  const current = context.components.get(Current);

  await context.current.switchSite(1, 2);

  console.log(current.tables.get("options"));
});

test("Invalid site id and blog id", async () => {
  const context = await Application.getContext("multi");

  await expect(context.current.switchSite(1, 999999)).rejects.toThrow();

  await context.current.switchSite(999999, 1);
});
