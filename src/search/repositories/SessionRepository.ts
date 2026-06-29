import { getRecentlyClosed } from "../../browser/services/sessionService";
import SessionMapper from "../mappers/SessionMapper";
import type { SearchableSession } from "../entities";

export default class SessionRepository {
  static async getAll(): Promise<SearchableSession[]> {
    const sessions = await getRecentlyClosed();
    return new SessionMapper().mapMany(sessions);
  }
}
