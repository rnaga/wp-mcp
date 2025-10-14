import Application from "@rnaga/wp-node/application";

import { AuthSession, getAuthSession } from "../session/auth-session";

import type * as wpCoreTypes from "@rnaga/wp-node/types";

type Context = Awaited<ReturnType<(typeof Application)["getContext"]>>;

export class PasswordProvider {
  protected authSessions: AuthSession;

  constructor() {
    this.authSessions = getAuthSession();
  }

  private getSessionKey(username: string, password: string) {
    return `${username}:${password}`;
  }

  async authenticate(wp: Context, username: string, password: string) {
    const sessionKey = this.getSessionKey(username, password);
    const cached = await this.authSessions.get("password", sessionKey);

    if (cached && cached.type === "password") {
      return cached.user as wpCoreTypes.WpUsers;
    }

    const user = await wp.utils.applicationPasswords.authenticate(
      username,
      password
    );
    if (!user) {
      return undefined;
    }

    const userInfo = user.props;

    if (userInfo) {
      this.authSessions.set(
        "password",
        this.getSessionKey(username, password),
        {
          type: "password",
          user: userInfo,
        },
        600
      );
    }

    return user.props;
  }
}
