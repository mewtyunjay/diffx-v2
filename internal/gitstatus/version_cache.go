package gitstatus

func newVersionCache(maxEntries int) *versionCache {
	return &versionCache{
		maxEntries: maxEntries,
		items:      make(map[string]cachedFileVersion, maxEntries),
	}
}

func (c *versionCache) Get(key string) (cachedFileVersion, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	value, ok := c.items[key]
	if !ok {
		return cachedFileVersion{}, false
	}

	c.touch(key)

	return value, true
}

func (c *versionCache) Set(key string, value cachedFileVersion) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if _, ok := c.items[key]; ok {
		c.items[key] = value
		c.touch(key)
		return
	}

	c.items[key] = value
	c.order = append(c.order, key)

	if len(c.order) <= c.maxEntries {
		return
	}

	evicted := c.order[0]
	c.order = c.order[1:]
	delete(c.items, evicted)
}

func (c *versionCache) touch(key string) {
	for index, existing := range c.order {
		if existing != key {
			continue
		}

		c.order = append(c.order[:index], c.order[index+1:]...)
		break
	}

	c.order = append(c.order, key)
}
