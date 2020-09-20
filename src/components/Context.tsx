/* eslint-disable import/group-exports, filenames/match-exported, no-unused-vars */
import * as React from 'react';

import { SqVerificationDetails, SqError, SqVerificationResult, PayState } from './models';

export interface ContextInterface {
  /** Apple pay state*/
  applePayState?: PayState;
  /** Called to actually build the form */
  build: () => void;
  /** Called to actually destroy the form */
  destroy: () => void;
  /** any error */
  error: string;
  /** Unique form ID */
  formId?: string;
  /** Google pay state*/
  googlePayState?: PayState;
  /** Whether the form has successfully loaded */
  loaded: boolean;
  /** Masterpass state */
  masterpassState?: PayState;
  /** Function that is called to create a nonce */
  onCreateNonce?: () => void;
  /** Function that is called to verify the buyer */
  onVerifyBuyer?: (
    source: string,
    verificationDetails: SqVerificationDetails,
    callback: (err: SqError, verificationResult: SqVerificationResult) => void
  ) => void;
}

/**
 * Internal helper that the `SquarePaymentForm` uses to manage internal state and expose access to the SqPaymentForm library.
 *
 * This is available for developers who require more customization over their payment form implementation. Please refer to the
 * [customization](customization.md) page for usage details.
 */
export const Context = React.createContext<ContextInterface>({
  applePayState: 'loading',
  build: () => null,
  destroy: () => null,
  error: '',
  formId: '',
  googlePayState: 'loading',
  loaded: false,
  masterpassState: 'loading',
  onCreateNonce: () => {},
  onVerifyBuyer: (
    source: string,
    verificationDetails: SqVerificationDetails,
    callback: (err: SqError, verificationResult: SqVerificationResult) => void
  ) => {},
});

export default Context;
/* eslint-enable import/group-exports, filenames/match-exported, no-unused-vars */
