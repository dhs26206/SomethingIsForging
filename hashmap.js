class HashMap {
    constructor() {
        this.map = new Map();
    }

    // Function to add a key-value pair to the map
    add(key, value) {
        this.map.set(key, value);
    }

    // Function to get the value by the key from the map
    get(key) {
        return this.map.get(key);
    }
    has(key) {
        return this.map.has(key);
    }
}

module.exports = HashMap;
