# Add Tests to a React Component Library Using Themis

## Problem Description

Your company maintains a React component library called `ui-kit` written in TypeScript. The library includes components that import CSS modules, SVG icons, and PNG images as part of their implementation. The project recently switched to Themis for unit testing.

A new engineer joined the team and wants to add tests for two components: a `Button` component that imports a CSS module for styles, and an `Icon` component that imports an SVG file and a PNG fallback. The engineer is concerned about how to handle the non-JS imports during testing and has started sketching out a configuration approach.

Your task is to write tests for these two components and set up whatever is needed to make the import situation work correctly for a Themis project.

## Output Specification

1. Write test files for the `Button` and `Icon` components. Place them in a location appropriate for a Themis project.
2. Provide a `APPROACH.md` file explaining how you handled the CSS, SVG, and PNG imports in your testing setup — specifically what files you created (or chose NOT to create) and why.

You do not need to run the tests. The source files are provided below as inputs.

## Input Files

The following files are provided as inputs. Extract them before beginning.

=============== FILE: src/Button.tsx ===============
import styles from './Button.module.css';

interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function Button({ label, onClick, disabled = false }: ButtonProps) {
  return (
    <button
      className={styles.button}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

=============== FILE: src/Icon.tsx ===============
import iconSvg from './assets/icon.svg';
import fallbackPng from './assets/fallback.png';

interface IconProps {
  size?: number;
  useFallback?: boolean;
}

export function Icon({ size = 24, useFallback = false }: IconProps) {
  const src = useFallback ? fallbackPng : iconSvg;
  return <img src={src} width={size} height={size} alt="icon" />;
}
