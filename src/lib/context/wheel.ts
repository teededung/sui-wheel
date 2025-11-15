import { Context } from 'runed';

// Context for sharing wheel-related APIs and dependencies to the Wheel component
export interface WheelContext {
	signAndExecuteTransaction?: (tx: unknown) => Promise<unknown>;
	suiClient?: {
		waitForTransaction?: (...args: unknown[]) => Promise<unknown> | unknown;
	};
	packageId?: string;
	WHEEL_MODULE?: string;
	WHEEL_FUNCTIONS?: Record<string, string>;
	RANDOM_OBJECT_ID?: string;
	CLOCK_OBJECT_ID?: string;
	VERSION_OBJECT_ID?: string;
	fetchWheelFromChain?: () => Promise<void>;
	setSpinning?: (value: boolean) => void;
	onShuffle?: () => void;
	onClear?: () => void;
	onClearAllEntries?: () => void;
	onOffchainWinner?: (winner: string) => void;
	removeEntry?: (value: string) => void;
}

export const wheelContext = new Context<WheelContext>('wheel');
