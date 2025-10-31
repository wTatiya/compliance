import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  dir: './'
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^chart.js$': '<rootDir>/src/__mocks__/chartjs.ts',
    '^react-chartjs-2$': '<rootDir>/src/__mocks__/react-chartjs-2.tsx'
  }
};

export default createJestConfig(customJestConfig);
