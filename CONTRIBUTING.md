# Contributing to on_the_money.js

Thank you for your interest in contributing to on_the_money.js! This document provides guidelines and instructions for contributing.

## Development Philosophy

on_the_money.js follows the **Anti-Framework** principles outlined in SPEC.md:
- DOM is the Database
- CSS is the UI Engine
- No String Injection
- Deterministic Localization
- Inclusive by Design

All contributions must adhere to these principles.

## Development Setup

### Prerequisites
- Node.js >= 18.0.0
- npm >= 8.0.0

### Installation
1. Fork and clone the repository:
```bash
git clone https://github.com/your-username/on_the_money.js.git
cd on_the_money.js
```

2. Install dependencies:
```bash
npm install
```

3. Verify installation:
```bash
npm test
npm run lint
```

## Project Structure

```
on_the_money.js/
├── src/                    # Source code
│   ├── core/              # Core library implementation
│   ├── linter/            # Linter rules and CLI logic
│   ├── plugins/           # ESLint plugin implementations
│   └── utils/             # Shared utilities
├── test/                  # Test files
├── dist/                  # Built distribution files
├── examples/              # Example projects
├── package.json
├── README.md
├── SPEC.md
└── CONTRIBUTING.md
```

## Code Style

### JavaScript
- Use ES modules (`import`/`export`)
- Follow the existing code style (2-space indentation, semicolons)
- Write concise, self-documenting code
- Avoid defensive coding - let unexpected states crash
- Use guard conditions instead of deep nesting

### Comments
- Only comment when explaining non-obvious, hacky, or exceptional code
- No JSDoc unless the function signature is complex

### Testing
- Write tests for all new features
- Ensure all tests pass before submitting a PR
- Use Node.js's built-in test runner
- Tests should be deterministic and fast

## Development Workflow

1. **Create an issue** (if one doesn't exist) describing the bug or feature
2. **Fork the repository** and create a feature branch:
```bash
git checkout -b feature/your-feature-name
```

3. **Make your changes** following the code style guidelines

4. **Test your changes**:
```bash
npm test
npm run lint
```

5. **Update documentation** if needed (README.md, SPEC.md, etc.)

6. **Commit your changes** using concise, descriptive commit messages:
```bash
git commit -m "Add feature: description of changes"
```

7. **Push to your fork**:
```bash
git push origin feature/your-feature-name
```

8. **Open a Pull Request** against the main repository's `main` branch

## Linter Development

### Adding New Rules
1. Add the rule definition in `src/linter/rules/`
2. Implement the rule logic with appropriate AST traversal
3. Add tests in `test/linter/rules/`
4. Update the ESLint plugin in `src/plugins/eslint-plugin/`
5. Update the CLI to include the new rule

### Rule Structure
Each rule should:
- Have a unique ID (OTM-XXX)
- Include clear error messages
- Provide fix suggestions when possible
- Follow the patterns in existing rules

## Testing

### Running Tests
```bash
npm test              # Run all tests
npm test -- --watch   # Run tests in watch mode
npm test -- --test-name="test name"  # Run specific test
```

### Test Coverage
- Aim for high test coverage
- Tests should be fast and isolated
- Mock external dependencies when necessary

## Documentation

- Update README.md for user-facing changes
- Update SPEC.md for architectural changes
- Add JSDoc comments only for public APIs
- Include examples for new features

## Release Process

1. **Version Bumping**: Use semantic versioning
2. **Changelog**: Update CHANGELOG.md with notable changes
3. **Build**: Run `npm run build` to generate dist files
4. **Publish**: Maintainers will publish to npm

## Code Review Process

All PRs require:
1. Passing CI checks (tests, linting)
2. Review from at least one maintainer
3. Adherence to project principles
4. Updated documentation if needed

## Getting Help

- Open an issue for questions
- Check existing issues and PRs
- Review SPEC.md for architectural guidance

## License

By contributing, you agree that your contributions will be licensed under the project's MIT License.
