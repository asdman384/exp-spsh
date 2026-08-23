# Angular Features Playground

A dedicated sandbox for testing and exploring new Angular features without affecting the main application.

## Access

Navigate to: `http://localhost:4200/exp-spsh/playground`

## Features

- **No Guards**: Accessible without login or setup requirements
- **Isolated Component**: Independent from the main dashboard and setup flows
- **Feature Testing Area**: Grid layout for testing individual Angular features
- **Sandbox Section**: Dedicated area for experimental components

## Getting Started

### 1. Basic Feature Cards
The playground comes with a feature grid showing example features:
- Signals
- Control Flow
- Directives
- Pipes
- Dependency Injection

Each feature card is clickable and logs to the console when clicked.

### 2. Adding New Test Components

Edit `playground.component.ts` to add new test features or components:

```typescript
testFeatures = [
  { name: 'Signals', implemented: false },
  { name: 'New Feature', implemented: false },
  // Add more features here
];
```

### 3. Using the Sandbox Section

The `<div class="sandbox">` area in `playground.component.html` is ready for experimental components:

```html
<section class="sandbox-section">
  <h2>Sandbox Area</h2>
  <div class="sandbox">
    <!-- Add test components here -->
    <your-experimental-component></your-experimental-component>
  </div>
</section>
```

## Styling

The playground includes responsive styles via `playground.component.scss`:
- Clean, modern layout
- Feature card hover effects
- Mobile-friendly grid
- Sandbox area for visual testing

## Testing

Run the playground tests:
```bash
npm test -- playground.component
```

The test suite includes:
- Component creation
- Title and properties verification
- Template rendering
- Click handlers

## Notes

- This is a **no-auth zone** — use it freely without login
- Changes here won't affect the main application
- Use the browser console to debug test features
- Commit your experiments separately to keep playground clean
