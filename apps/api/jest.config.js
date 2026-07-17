/** Unit test configuration (co-located *.spec.ts under src/). */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@famifinances/contracts$': '<rootDir>/../../../packages/contracts/src/index.ts',
  },
  testEnvironment: 'node',
};
