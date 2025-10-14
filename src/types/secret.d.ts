import { z } from "zod";
import * as vals from "../validators";

export type Secret = z.infer<typeof vals.secretValidator>;
