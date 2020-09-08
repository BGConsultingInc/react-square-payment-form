import React, { useState, useEffect, useRef, useCallback } from 'react';

import { ContextInterface } from '../components/Context';

import {
  PayState,
  SqError,
  SqCardData,
  SqContact,
  SqMethods,
  SqPaymentRequest,
  SqShippingOption,
  SqPaymentFormConfiguration,
  SqVerificationResult,
  SqVerificationDetails,
} from '../components/models';

import useDynamicCallback from './useDynamicCallback';

declare class SqPaymentForm {
  constructor(configuration: SqPaymentFormConfiguration);

  build: () => void;
  destroy: () => void;
  recalculateSize: () => void;
  requestCardNonce: () => void;
  setPostalCode: (postal: string) => void;
  focus: (id: string) => void;
  masterpassImageUrl: () => string;
  verifyBuyer: (
    source: string,
    verificationDetails: SqVerificationDetails,
    callback: (err: SqError, verificationResult: SqVerificationResult) => void
  ) => void;
}

interface Props {
  /** <b>Required for all features</b><br/><br/>Identifies the calling form with a verified application ID generated from the Square Application Dashboard */
  applicationId: string;
  /** <b>Required for all features</b><br/><br/>Identifies the location of the merchant that is taking the payment. Obtained from the Square Application Dashboard - Locations tab.*/
  locationId: string;
  /** <b>Required for all features</b><br/><br/>Identifies the DOM form element*/
  formId: string;
  /** Define the internal styles applied to the rendered iframes */
  inputStyles?: Record<string, unknown>[];
  /** Define the CSS class of input iframe elements */
  inputClass?: string;
  /** Internal variable: used for logs */
  apiWrapper: string;
  /** Enables Sandbox mode */
  sandbox: boolean;
  /** Square payment form components */
  children?: React.ReactNode;

  /** Change the placeholder for the CVV input */
  placeholderCVV?: string;
  /** Change the placeholder for the postal code input */
  placeholderPostal?: string;
  /** Change the placeholder for the credit card input */
  placeholderCreditCard?: string;
  /** Change the placeholder for the expiration date input */
  placeholderExpiration?: string;
  /** Change the placeholder for the gift card input */
  placeholderGiftCard?: string;

  /** <b>Required for all features</b><br/><br/>Invoked when payment form receives the result of a nonce generation request. The result will be a valid credit card or wallet nonce, or an error.*/
  cardNonceResponseReceived: (
    errors: [SqError] | null,
    nonce: string,
    cardData: SqCardData,
    buyerVerificationToken?: string,
    billingContact?: SqContact,
    shippingContact?: SqContact,
    shippingOption?: SqShippingOption
  ) => void;
  /** <b>Required for digital wallets</b><br/><br/>Invoked when a digital wallet payment button is clicked.*/
  createPaymentRequest?: () => SqPaymentRequest;
  /** <b>Required for SCA</b><br/><br/> */
  createVerificationDetails?: () => SqVerificationDetails;
  /* Triggered when the page renders to decide which, if any, digital wallet button should be rendered in the payment form */
  methodsSupported?: (methods: SqMethods) => void;
  /** Invoked when visitors interact with the iframe elements */
  inputEventReceived?: () => void;
  /** Invoked when payment form is fully loaded */
  paymentFormLoaded?: () => void;
  /** Invoked when requestShippingAddress is true in PaymentRequest and the buyer selects a shipping address in the Apple Pay sheet or enters a new shipping address.*/
  shippingContactChanged?: (shippingContact: SqContact, done: ({}) => Record<string, unknown>) => void;
  /** Invoked when the buyer selects a shipping option in the Apple Pay sheet. */
  shippingOptionChanged?: (shippingOption: SqShippingOption, done: ({}) => Record<string, unknown>) => void;
  /** Invoked when the payment form is hosted in an unsupported browser */
  unsupportedBrowserDetected?: () => void;

  /** Postal code to be set on paymentFormLoaded */
  postalCode?: () => string;
  /** Field to be focused on paymentFormLoaded (valid values are cardNumber, postalCode, expirationDate, cvv) */
  focusField?: () => 'cardNumber' | 'cvv' | 'expirationDate' | 'postalCode';
}

interface State {
  applePayState: string;
  googlePayState: string;
  masterpassState: string;
  errorMessage?: string;
  scriptLoaded: boolean;
}

const defaultProps = {
  apiWrapper: 'reactjs/0.7.0',
  formId: 'sq-payment-form',
  inputClass: 'sq-input',
  inputStyles: [
    {
      _mozOsxFontSmoothing: 'grayscale',
      _webkitFontSmoothing: 'antialiased',
      backgroundColor: 'transparent',
      color: '#373F4A',
      fontFamily: 'Helvetica Neue',
      fontSize: '16px',
      lineHeight: '24px',
      padding: '16px',
      placeholderColor: '#CCC',
    },
  ],
  placeholderCVV: 'CVV',
  placeholderCreditCard: '• • • •  • • • •  • • • •  • • • •',
  placeholderExpiration: 'MM/YY',
  placeholderGiftCard: '• • • •  • • • •  • • • •  • • • •',
  placeholderPostal: '12345',
  sandbox: false,
};

const loadSqPaymentFormLibrary = (sandbox: boolean, onSuccess?: () => void, onError?: () => void): void => {
  if (document.getElementById('sq-payment-form-script') && typeof SqPaymentForm === 'function') {
    onSuccess && onSuccess();
    return;
  }

  const script = document.createElement('script');
  script.id = 'sq-payment-form-script';

  script.src = sandbox ? 'https://js.squareupsandbox.com/v2/paymentform' : 'https://js.squareup.com/v2/paymentform';

  script.onload = function() {
    onSuccess && onSuccess();
  };
  script.onerror = function() {
    onError && onError();
  };
  document.body.appendChild(script);
};

interface SqPaymentHook {
  build: () => void;
  context: ContextInterface;
  error: string | undefined;
  loaded: boolean;
  submit: () => void;
}

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
const useSquarePaymentForm = (props: Props): SqPaymentHook => {
  const [applePayState, setApplePayState] = useState<PayState>('loading');
  const [googlePayState, setGooglePayState] = useState<PayState>('loading');
  const [masterpassState, setMasterpassState] = useState<PayState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const paymentFormRef = useRef<SqPaymentForm | undefined>(undefined);
  const [built, setBuilt] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const { inputStyles = defaultProps.inputStyles, inputClass = defaultProps.inputClass } = props;

  const cardNonceResponseReceived = (
    errors: [SqError],
    nonce: string,
    cardData: SqCardData,
    billingContact: SqContact,
    shippingContact: SqContact,
    shippingOption: SqShippingOption
  ): void => {
    if (errors || !props.createVerificationDetails) {
      props.cardNonceResponseReceived(errors, nonce, cardData, '', billingContact, shippingContact, shippingOption);
      return;
    }

    const paymentForm = paymentFormRef.current;

    if (!paymentForm) {
      return;
    }

    paymentForm.verifyBuyer(
      nonce,
      props.createVerificationDetails(),
      (err: SqError | null, result: SqVerificationResult) => {
        props.cardNonceResponseReceived(
          err ? [err] : null,
          nonce,
          cardData,
          result ? result.token : undefined,
          billingContact,
          shippingContact,
          shippingOption
        );
      }
    );
  };

  // Fixes stale closure issue with using React Hooks & SqPaymentForm callback functions
  // https://github.com/facebook/react/issues/16956
  const cardNonceResponseReceivedCallback = useDynamicCallback(cardNonceResponseReceived);

  const createNonce = useCallback(() => {
    const paymentForm = paymentFormRef.current;

    paymentForm && paymentForm.requestCardNonce();
  }, [paymentFormRef]);

  const verifyBuyer = useCallback(
    (
      source: string,
      verificationDetails: SqVerificationDetails,
      callback: (err: SqError, verificationResult: SqVerificationResult) => void
    ) => {
      const paymentForm = paymentFormRef.current;

      paymentForm && paymentForm.verifyBuyer(source, verificationDetails, callback);
    },
    [paymentFormRef]
  );

  const methodsSupported = (methods: SqMethods): void => {
    const keys = Object.keys(methods);

    if (keys.includes('masterpass')) {
      setMasterpassState(methods.masterpass === true ? 'ready' : 'unavailable');
    }
    if (keys.includes('applePay')) {
      setApplePayState(methods.applePay === true ? 'ready' : 'unavailable');
    }
    if (keys.includes('googlePay')) {
      setGooglePayState(methods.googlePay === true ? 'ready' : 'unavailable');
    }
  };

  const paymentFormLoaded = () => {
    setLoaded(true);
  };

  function buildSqPaymentFormConfiguration(props: Props): SqPaymentFormConfiguration {
    const config: SqPaymentFormConfiguration = {
      apiWrapper: props.apiWrapper || defaultProps.apiWrapper,
      applicationId: props.applicationId,
      autoBuild: false,
      callbacks: {
        cardNonceResponseReceived: cardNonceResponseReceivedCallback,
        createPaymentRequest: props.createPaymentRequest,
        inputEventReceived: props.inputEventReceived,
        methodsSupported: props.methodsSupported,
        paymentFormLoaded,
        shippingContactChanged: props.shippingContactChanged,
        shippingOptionChanged: props.shippingOptionChanged,
        unsupportedBrowserDetected: props.unsupportedBrowserDetected,
      },
      locationId: props.locationId,
    };

    const formId = props.formId || defaultProps.formId;

    // "The SqPaymentForm object in single-element payment form mode does not support digital wallets."
    // https://developer.squareup.com/docs/payment-form/payment-form-walkthrough#single-element-payment-form-and-digital-wallet-support
    if (document.getElementById(`${formId}-sq-card`)) {
      config.card = {
        elementId: `${formId}-sq-card`,
        inputStyle: inputStyles && inputStyles[0],
      };
    } else if (document.getElementById(`${formId}-sq-gift-card`)) {
      config.giftCard = {
        elementId: `${formId}-sq-gift-card`,
        placeholder: props.placeholderGiftCard || defaultProps.placeholderGiftCard,
      };
      config.inputClass = inputClass;
      config.inputStyles = inputStyles;
    } else {
      config.inputClass = inputClass;
      config.inputStyles = inputStyles;

      if (document.getElementById(`${formId}-sq-apple-pay`)) {
        config.applePay = { elementId: `${formId}-sq-apple-pay` };
      }
      if (document.getElementById(`${formId}-sq-google-pay`)) {
        config.googlePay = { elementId: `${formId}-sq-google-pay` };
      }
      if (document.getElementById(`${formId}-sq-masterpass`)) {
        config.masterpass = { elementId: `${formId}-sq-masterpass` };
      }

      if (document.getElementById(`${formId}-sq-card-number`)) {
        config.cardNumber = {
          elementId: `${formId}-sq-card-number`,
          placeholder: props.placeholderCreditCard || defaultProps.placeholderCreditCard,
        };
      }
      if (document.getElementById(`${formId}-sq-cvv`)) {
        config.cvv = {
          elementId: `${formId}-sq-cvv`,
          placeholder: props.placeholderCVV || defaultProps.placeholderCVV,
        };
      }
      if (document.getElementById(`${formId}-sq-postal-code`)) {
        config.postalCode = {
          elementId: `${formId}-sq-postal-code`,
          placeholder: props.placeholderPostal || defaultProps.placeholderPostal,
        };
      } else {
        config.postalCode = false;
      }
      if (document.getElementById(`${formId}-sq-expiration-date`)) {
        config.expirationDate = {
          elementId: `${formId}-sq-expiration-date`,
          placeholder: props.placeholderExpiration || defaultProps.placeholderExpiration,
        };
      }
    }
    return config;
  }

  useEffect(() => {
    if (scriptLoaded) {
      return;
    }

    loadSqPaymentFormLibrary(
      props.sandbox ?? defaultProps.sandbox,
      () => setScriptLoaded(true),
      () => setErrorMessage('Unable to load Square payment library')
    );
  }, []);

  // build the SqPaymentForm object and manage it's lifecycle.
  useEffect(() => {
    const cleanup = () => {
      const paymentForm = paymentFormRef.current;

      if (!paymentForm) {
        return;
      }

      try {
        paymentForm && paymentForm.destroy();
      } finally {
        paymentFormRef.current = undefined;

        setLoaded(false);
        setBuilt(false);
      }
    };

    if (built === false) {
      return cleanup;
    }

    if (paymentFormRef.current !== undefined) {
      // super odd if we get here
      setErrorMessage('Square payment form has already been initialized');

      return cleanup;
    }

    if (errorMessage.length > 0) {
      // there's already an error
      return cleanup;
    }

    let paymentForm = null;

    try {
      paymentForm = new SqPaymentForm(buildSqPaymentFormConfiguration({ methodsSupported, ...props }));
      paymentForm.build();
    } catch (error) {
      const errorMessage = error.message || 'Unable to build Square payment form';
      setErrorMessage(errorMessage);

      return cleanup;
    }

    paymentFormRef.current = paymentForm;

    return cleanup;
  }, [built, paymentFormRef]);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    const paymentForm = paymentFormRef.current;

    if (!paymentForm) {
      return;
    }

    paymentForm.recalculateSize();

    props.postalCode && paymentForm.setPostalCode(props.postalCode());
    props.focusField && paymentForm.focus(props.focusField());

    props.paymentFormLoaded && props.paymentFormLoaded()
  }, [loaded, paymentFormRef])

  useEffect(() => {
    const paymentForm = paymentFormRef.current;

    if (!paymentForm || masterpassState !== 'ready') {
      return;
    }
    const srcBtn = document.getElementById(`${props.formId}-sq-masterpass`);

    if (!srcBtn) {
      return;
    }
    const imageUrl = paymentForm.masterpassImageUrl();
    srcBtn.style.display = 'inline-block';
    srcBtn.style.backgroundImage = `url(${imageUrl})`;
  }, [paymentFormRef, masterpassState]);

  return {
    build: useCallback(() => setBuilt(true), []),
    context: {
      applePayState,
      formId: props.formId || defaultProps.formId,
      googlePayState,
      masterpassState,
      onCreateNonce: createNonce,
      onVerifyBuyer: verifyBuyer,
    },
    error: errorMessage,
    loaded,
    submit: createNonce,
  };
};

export { Props, useSquarePaymentForm, defaultProps };
