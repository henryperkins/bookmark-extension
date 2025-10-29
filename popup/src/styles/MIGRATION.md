# Design System Migration Guide

This guide helps migrate existing component styles to use the new shared design system.

## Quick Migration Steps

### 1. Import the Design System Hook

```typescript
// Before
import { useDesignSystem } from '../hooks/useDesignSystem';

// In your component
const { utils, tokens } = useDesignSystem();
```

### 2. Replace Hardcoded Styles

**Typography:**
```typescript
// Before
const styles = {
  typography: {
    fontBody: '14px',
    lineBody: '20px',
    weightSemibold: 600,
  }
};

// After
const { utils } = useDesignSystem();
// Usage:
style={utils.typography.body({ fontWeight: tokens.typography.weightSemibold })}
```

**Spacing:**
```typescript
// Before
const styles = {
  spacing: {
    sm: '8px',
    lg: '16px',
  }
};

// After
// Usage:
padding: utils.spacing.lg,
margin: utils.spacing.sm,
gap: utils.spacing.md,
```

**Colors:**
```typescript
// Before
const styles = {
  colors: {
    primary: '#0078d4',
    text: '#1a1a1a',
  }
};

// After
// Usage:
color: utils.colors.primary,
backgroundColor: utils.colors.background,
borderColor: utils.colors.border,
```

**Buttons:**
```typescript
// Before
<button style={{
  background: '#0078d4',
  color: '#ffffff',
  padding: '8px 16px',
  borderRadius: '4px',
  border: 'none',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
}}>

// After
<button style={utils.button.primary()}>

// Custom button style:
<button style={utils.button.primary({
  padding: `${tokens.spacing.sm} ${tokens.spacing.xl}`,
})}>
```

## Component Migration Examples

### Example 1: ProgressHeader Component

**Before:**
```typescript
const styles = {
  typography: {
    fontBody: '14px',
    fontCaption: '12px',
    lineBody: '20px',
    weightSemibold: 600,
  },
  spacing: {
    sm: '8px',
    lg: '16px',
  },
  colors: {
    text: '#1a1a1a',
    primary: '#0078d4',
  },
};

// Usage:
style={{
  padding: styles.spacing.lg,
  fontSize: styles.typography.fontBody,
  fontWeight: styles.typography.weightSemibold,
  color: styles.colors.text,
}}
```

**After:**
```typescript
const { utils, tokens } = useDesignSystem();

// Usage:
style={{
  padding: utils.spacing.lg,
  ...utils.typography.body({
    fontWeight: tokens.typography.weightSemibold,
  }),
  color: utils.colors.text,
}}
```

### Example 2: JobHistory Component

**Before:**
```typescript
const styles = {
  typography: {
    fontCaption: '12px',
    fontBody: '14px',
    lineCaption: '16px',
    weightSemibold: 600,
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
  },
  colors: {
    text: '#1a1a1a',
    primary: '#0078d4',
    success: '#107c10',
    border: '#c7c7c7',
    background: '#f9f9f9',
  },
};

// Card styling:
style={{
  border: `1px solid ${styles.colors.border}`,
  borderRadius: '4px',
  padding: styles.spacing.md,
  backgroundColor: styles.colors.background,
}}
```

**After:**
```typescript
const { utils, tokens } = useDesignSystem();

// Card styling:
style={utils.layout.card({
  padding: utils.spacing.md,
})}
```

## Benefits of Migration

### 1. **Consistency**
- All components use the same design tokens
- Automatic adherence to design system guidelines
- Reduced visual inconsistencies

### 2. **Maintainability**
- Single source of truth for design values
- Easy to update global styles
- Reduced code duplication

### 3. **Type Safety**
- TypeScript types for all design tokens
- Autocomplete support in IDEs
- Compile-time error checking

### 4. **Performance**
- Memoized styles reduce re-renders
- Shared utilities reduce bundle size
- CSS custom properties for dynamic theming

## Best Practices

### 1. Use Style Utilities
```typescript
// Good
style={utils.typography.subtitle()}
style={utils.button.primary()}

// Also Good (for customizations)
style={utils.typography.subtitle({ color: utils.colors.primary })}
```

### 2. Leverage Layout Utilities
```typescript
// Flex layouts
style={utils.layout.flex.center()}
style={utils.layout.flex.between()}

// Card layouts
style={utils.layout.card()}
```

### 3. Maintain Responsive Design
```typescript
import { useResponsive } from '../hooks/useDesignSystem';

const { isMobile } = useResponsive();

const dynamicStyle = isMobile
  ? { padding: utils.spacing.sm }
  : { padding: utils.spacing.lg };
```

### 4. Support Theme Variations
```typescript
const { cssCustomProperties } = useDesignSystem();

// Apply CSS custom properties
<div style={cssCustomProperties}>
  {/* Component content */}
</div>
```

## Migration Checklist

- [ ] Import `useDesignSystem` hook
- [ ] Replace hardcoded style objects with design system utilities
- [ ] Update typography to use `utils.typography.*()`
- [ ] Update spacing to use `utils.spacing.*`
- [ ] Update colors to use `utils.colors.*`
- [ ] Use `utils.button.*()` for button styling
- [ ] Use `utils.input.*()` for form inputs
- [ ] Use `utils.layout.*()` for layout patterns
- [ ] Test visual appearance after migration
- [ ] Test responsive behavior
- [ ] Test accessibility features

## Troubleshooting

### Issue: Styles not applying
**Solution:** Make sure to import and use the hook:
```typescript
const { utils } = useDesignSystem();
```

### Issue: Type errors
**Solution:** Use the utility functions correctly:
```typescript
// Correct
style={utils.typography.body()}

// Incorrect
style={utils.typography.body} // This is a function
```

### Issue: Missing custom styles
**Solution:** Merge with additional styles:
```typescript
style={{
  ...utils.typography.subtitle(),
  color: 'custom-color', // Override or extend
}}
```

## Future Enhancements

The design system is designed to be extensible:

1. **Dark Mode Support:** Built-in theme management
2. **Custom Theming:** Override design tokens per component
3. **Animation System:** Consistent motion design
4. **Component Library:** Pre-built component variants
5. **Design Tokens Export:** Share with other projects

## Support

For questions about the design system migration:
1. Check the design system documentation in `designSystem.ts`
2. Review existing component examples
3. Consult the migration examples in this guide
4. Reach out to the development team for complex scenarios