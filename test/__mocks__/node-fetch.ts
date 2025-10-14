const mockFetch = jest.fn();
const Response = jest.fn();

// Mock global fetch
(global as any).fetch = mockFetch;

export default mockFetch;
export { Response };
