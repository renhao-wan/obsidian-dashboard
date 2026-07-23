/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: {
    '^obsidian$': '<rootDir>/tests/__mocks__/obsidian.ts',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@data/(.*)$': '<rootDir>/src/data/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@renderers/(.*)$': '<rootDir>/src/renderers/$1',
    '^@sections/(.*)$': '<rootDir>/src/sections/$1',
    '^@modals/(.*)$': '<rootDir>/src/modals/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
};
