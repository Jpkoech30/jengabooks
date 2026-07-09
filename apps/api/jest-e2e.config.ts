import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.e2e-spec\\.ts$',  // Matches .e2e-spec.ts files
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@jengabooks/shared$': '<rootDir>/../../../packages/shared/src',
  },
  testTimeout: 30000,
};

export default config;
