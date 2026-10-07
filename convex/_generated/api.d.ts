/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounts from "../accounts.js";
import type * as admins from "../admins.js";
import type * as entries from "../entries.js";
import type * as guests from "../guests.js";
import type * as history from "../history.js";
import type * as http from "../http.js";
import type * as likes from "../likes.js";
import type * as participants from "../participants.js";
import type * as queue from "../queue.js";
import type * as seed from "../seed.js";
import type * as settings from "../settings.js";
import type * as submissions from "../submissions.js";
import type * as tutorials from "../tutorials.js";
import type * as tv from "../tv.js";
import type * as validators from "../validators.js";
import type * as votes from "../votes.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accounts: typeof accounts;
  admins: typeof admins;
  entries: typeof entries;
  guests: typeof guests;
  history: typeof history;
  http: typeof http;
  likes: typeof likes;
  participants: typeof participants;
  queue: typeof queue;
  seed: typeof seed;
  settings: typeof settings;
  submissions: typeof submissions;
  tutorials: typeof tutorials;
  tv: typeof tv;
  validators: typeof validators;
  votes: typeof votes;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
