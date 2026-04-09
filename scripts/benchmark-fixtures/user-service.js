/**
 * Async user service that fetches from an API and caches results.
 * Tests need to mock fetch and verify caching behavior.
 */

class UserService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cache = new Map();
  }

  async getUser(id) {
    if (this.cache.has(id)) return this.cache.get(id);

    const response = await fetch(`${this.baseUrl}/users/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch user ${id}: ${response.status}`);
    }

    const user = await response.json();
    this.cache.set(id, user);
    return user;
  }

  async getUsers(ids) {
    const results = await Promise.allSettled(ids.map((id) => this.getUser(id)));
    return results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value);
  }

  invalidate(id) {
    if (id === undefined) {
      this.cache.clear();
      return;
    }
    this.cache.delete(id);
  }
}

module.exports = { UserService };
