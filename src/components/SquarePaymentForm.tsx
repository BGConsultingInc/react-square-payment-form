import React, { useEffect } from 'react';

import { Props, useSquarePaymentForm, defaultProps } from '../hooks/useSqPaymentForm';

import Context from './Context';

/**
 * Creates a Square Payment Form and renders form inputs to use inside of it.
 *
 * This component requires 3 arguments for basic use:
 * * **applicationId**: This can be found in your [Square Developer Dashboard](https://developer.squareup.com/apps)
 * for the current Square app you're developing
 * * **locationId**: You can retrieve this from the [Square Connect v2 Locations API](https://docs.connect.squareup.com/api/connect/v2#navsection-locations);
 * or your [Square Developer Dashboard](https://developer.squareup.com/apps).
 * It determines which Square location will receive credit for payments made with this form.
 * * **cardNonceResponseReceived**: This callback gives you a nonce to pass to your back-end server to make a "charge" request to Square.
 * * **createVerificationDetails**: This callback returns data used for [Strong Customer Authentication](https://developer.squareup.com/docs/sca-overview)
 *
 * ...and one additional argument for digital wallets:
 * * **createPaymentRequest**: This callback returns data to show information about the payment in the Apple Pay, Google Pay, and Masterpass interfaces.
 *
 * Please view the [Payment Form Data Models](https://docs.connect.squareup.com/api/paymentform) for additional information.
 */
export const SquarePaymentForm: React.FC<Props> = (props: Props) => {
  const context = useSquarePaymentForm(props);

  const { build, error, destroy } = context;

  useEffect(() => {
    build();

    return () => {
      destroy();
    };
  }, []);

  if (error) {
    return (
      <div className="sq-payment-form">
        <div className="sq-error-message">{error}</div>
      </div>
    );
  }

  return (
    <Context.Provider value={{ ...context }}>
      <div id={context.formId} className="sq-payment-form">
        {props.children}
      </div>
    </Context.Provider>
  );
};

SquarePaymentForm.defaultProps = defaultProps;
