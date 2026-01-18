module.exports = {
  preset: 'ts-jest',
  setupFilesAfterEnv: ['./scripts/testSetup.js'],
  testRegex: '\\.test\\.tsx?$',
  collectCoverage: false,
  testEnvironment: 'node',
  coverageReporters: ['lcovonly', 'text'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}'],
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: ['node_modules', '<rootDir>/src/index.ts', '.mock.ts'],
  moduleNameMapper: {
    '^jsvm3/runtime$': '<rootDir>/src/index.ts',
    '^jsvm3/compiler$': '<rootDir>/src/compiler/index.ts',
    '^jsvm3/artifact$': '<rootDir>/src/artifact/index.ts',
    '^jsvm3/full$': '<rootDir>/src/full/index.ts',
    '^jsvm3/exp$': '<rootDir>/src/exp.ts',
  },
};
