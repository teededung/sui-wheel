import { Context } from 'runed';

// Context for sharing wheel-related APIs and dependencies to the Wheel component
// Shape (for reference):
// {
//   signAndExecuteTransaction: (tx: any) => Promise<any>,
//   suiClient: { waitForTransaction: Function },
//   packageId: string,
//   WHEEL_MODULE: string,
//   WHEEL_FUNCTIONS: Record<string, string>,
//   RANDOM_OBJECT_ID: string,
//   CLOCK_OBJECT_ID: string,
//   fetchWheelFromChain?: () => Promise<void>,
//   setSpinning?: (v: boolean) => void,
//   onShuffle?: () => void,
//   onClear?: () => void,
//   removeEntry?: (value: string) => void
// }
export const wheelCtx = new Context('wheel');
