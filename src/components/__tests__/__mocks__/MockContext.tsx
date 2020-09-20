import { PayState } from '../../models';
import { ContextInterface } from '../../Context'

const context: ContextInterface = {
  applePayState: 'loading',
  build: jest.fn(),
  googlePayState: 'loading',
  loaded: false,
  masterpassState: 'loading',
  formId: 'form-id',
  onCreateNonce: jest.fn(),
  onVerifyBuyer: jest.fn(),
};

export default context;
