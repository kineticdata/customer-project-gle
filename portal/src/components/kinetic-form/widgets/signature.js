import { useState, forwardRef, useRef, useCallback, useEffect } from 'react';
import clsx from 'clsx';
import t from 'prop-types';
import { Modal } from '../../../atoms/Modal.jsx';
import { SignaturePad } from '@ark-ui/react/signature-pad';
import { Tabs } from '@ark-ui/react/tabs';
import { Icon } from '../../../atoms/Icon.jsx';
import {
  WidgetAPI,
  registerWidget,
  validateContainer,
  validateField,
} from './index.js';
import { getCsrfToken } from '@kineticdata/react';
import { toastError } from '../../../helpers/toasts.js';
import { Provider, useSelector } from 'react-redux';
import { store } from '../../../redux.js';

/**
 * @param {Object} props.field Kinetic field object
 * @param {SignatureWidgetConfig} props
 */
const SignatureComponent = forwardRef(
  (
    {
      field,
      disabled,
      modalTitle = 'Sign your form',
      signaturePadLabel = 'Signature',
      fullNameLabel = 'Full Name',
      agreementText = 'I understand this is a legal representation of my signature.',
      savedButtonLabel = 'Save',
      savedFileName = 'signature_widget',
      buttonLabel = 'Signature',
      clearButtonLabel = 'Clear',
      emptyLabel = 'Not signed',
    },
    ref,
  ) => {
    const canvasRef = useRef(null);
    // State for disabled state of the widget
    const [isDisabled, setIsDisabled] = useState(
      disabled ?? field.form().reviewMode(),
    );
    const profile = useSelector(state => state.app.profile);
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('draw');
    const [imageUrl, setImageUrl] = useState('');
    const [fullName, setFullName] = useState(
      profile.displayName || 'Full Name',
    );
    const [selectedStyle, setSelectedStyle] = useState('');
    const [savedSignature, setSavedSignature] = useState(() =>
      field.value()?.[0]
        ? `${field.form().fileDownloadPath(field.name())}/0/${encodeURIComponent(field.value()[0].name)}`
        : null,
    );

    const signatureFonts = [
      { font: 'Waiting for the Sunrise' },
      { font: 'Mynerve' },
      { font: 'Grechen Fuemen' },
      { font: 'Condiment' },
      { font: 'Nothing You Could Do' },
      { font: 'Comforter Brush' },
    ];

    // Function to get the value
    const getValue = useCallback(() => field.value(), [field]);

    // Function to reset the value externally
    const reset = useCallback(() => {
      setImageUrl('');
      setSavedSignature('');
      field.value([]);
    }, [field]);

    const generateSignatureImage = () => {
      const canvas = canvasRef.current;
      const canvasContext = canvas.getContext('2d');

      canvas.width = 500;
      canvas.height = 100;

      canvasContext.clearRect(0, 0, canvas.width, canvas.height);
      canvasContext.fillStyle = '#11005E';
      canvasContext.textAlign = 'center';
      canvasContext.textBaseline = 'middle';

      let fontSize = 48;
      canvasContext.font = `${fontSize}px ${selectedStyle}`;

      let textWidth = canvasContext.measureText(fullName.toUpperCase()).width;

      // Adjusts the font size to ensure the text fits within the canvas width
      while (textWidth > canvas.width - 20 && fontSize > 10) {
        fontSize -= 2;
        canvasContext.font = `${fontSize}px ${selectedStyle}`;
        textWidth = canvasContext.measureText(fullName.toUpperCase()).width;
      }

      canvasContext.fillText(
        fullName.toUpperCase(),
        canvas.width / 2,
        canvas.height / 2,
      );

      return canvas.toDataURL('image/png');
    };

    const dataUrlToBlob = dataUrl => {
      return fetch(dataUrl)
        .then(response => response.blob())
        .catch(error => console.error('Error converting image to blob', error));
    };

    const onSave = async () => {
      let signatureImageUrl =
        activeTab === 'draw' ? imageUrl : generateSignatureImage();

      let data = new FormData();
      data.append(
        'files',
        await dataUrlToBlob(signatureImageUrl),
        `${savedFileName}.png`,
      );

      fetch(field.form().fileUploadPath(), {
        method: 'POST',
        headers: { 'X-XSRF-TOKEN': getCsrfToken() },
        body: data,
      })
        .then(async response => {
          if (!response.ok) {
            throw new Error('Failed to save signature.');
          }

          const responseData = await response.json();
          field.value(responseData);
          setSavedSignature(signatureImageUrl);
          setOpen(false);
        })
        .catch(() => {
          toastError({
            title: 'Failed to save signature.',
          });
        });
    };

    const onExitComplete = () => {
      setImageUrl('');
    };

    const isSaveDisabled =
      (activeTab === 'draw' && !imageUrl) ||
      (activeTab === 'type' && (!selectedStyle || !fullName));

    // Define API ref
    const api = useRef({
      enable: () => setIsDisabled(false),
      disable: () => setIsDisabled(true),
      getValue,
      reset,
    });
    // Update API ref when its contents change
    useEffect(() => {
      Object.assign(api.current, { getValue, reset });
    }, [getValue, reset]);

    return (
      <WidgetAPI ref={ref} api={api.current}>
        <div className="flex-sc w-full gap-3">
          {isDisabled ? (
            // Read-only view of the saved signature, with no way to change it
            <div className="w-60 sm:w-68 h-14 flex-cc p-1 border border-base-300 rounded-box">
              {savedSignature ? (
                <img
                  src={savedSignature}
                  alt="signature"
                  className="max-h-full max-w-full object-contain rounded-box"
                />
              ) : (
                <span className="text-base-content/60">{emptyLabel}</span>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="w-60 sm:w-68 h-14 kbtn kbtn-outline text-base border-base-300 hover:bg-base-200"
            >
              {savedSignature ? (
                <img
                  src={savedSignature}
                  alt="signature"
                  className="max-h-full max-w-full object-contain rounded-box"
                />
              ) : (
                <span className="flex-cc gap-2">
                  {buttonLabel} <Icon name="writing" aria-label="signature" />
                </span>
              )}
            </button>
          )}
          {savedSignature && !isDisabled && (
            <button
              type="button"
              className="kbtn kbtn-ghost rounded-full"
              onClick={reset}
            >
              {clearButtonLabel}
            </button>
          )}
        </div>
        <Modal
          title={modalTitle}
          open={open && !isDisabled}
          onOpenChange={({ open }) => setOpen(open)}
          onExitComplete={onExitComplete}
          size="sm"
        >
          <div slot="body">
            <Tabs.Root
              value={activeTab}
              onValueChange={tab => setActiveTab(tab.value)}
            >
              <Tabs.List className="ktabs ktabs-box w-fit mb-6">
                <Tabs.Trigger value="draw" className={clsx('ktab')}>
                  <Icon name="writing" aria-label="draw"></Icon>
                  Draw
                </Tabs.Trigger>
                <Tabs.Trigger value="type" className={clsx('ktab')}>
                  <Icon name="keyboard" aria-label="keyboard"></Icon>
                  Type
                </Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="draw">
                <SignaturePad.Root
                  onDrawEnd={details =>
                    details
                      .getDataUrl('image/png')
                      .then(url => setImageUrl(url))
                  }
                >
                  <div className="mb-2 font-semibold text-base-content/60">
                    <SignaturePad.Label>{signaturePadLabel}</SignaturePad.Label>
                  </div>
                  <SignaturePad.Control
                    className={clsx(
                      'border bg-base-200 relative rounded-box transition-all',
                      'focus-within:ring-3 focus-within:ring-primary/40 outline-0',
                    )}
                  >
                    <SignaturePad.Segment />
                    <SignaturePad.Guide
                      className={clsx(
                        'h-[12.5rem] relative rounded-box',
                        'border-base-300',
                      )}
                    >
                      <SignaturePad.ClearTrigger
                        className="absolute top-2 right-2 mr-3 mt-3"
                        onClick={reset}
                      >
                        <Icon name="refresh" aria-label="reset"></Icon>
                      </SignaturePad.ClearTrigger>
                      <div className="flex-bc absolute bottom-4 left-5 right-6 border-t-2 border-base-300"></div>
                    </SignaturePad.Guide>
                  </SignaturePad.Control>
                </SignaturePad.Root>
              </Tabs.Content>
              <Tabs.Content value="type">
                <div className="field required w-full mb-4">
                  <label htmlFor="fullName">{fullNameLabel}</label>
                  <input
                    type="text"
                    id="fullName"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                  />
                </div>
                <hr className="mb-4 mt-6" />
                <div className="grid grid-cols-2 gap-4">
                  {signatureFonts.map(style => (
                    <label
                      key={style.font}
                      className="kbtn kbtn-outline flex-bc border-base-300 h-16 transition-all overflow-wrap-anywhere hover:bg-base-200"
                    >
                      <span
                        className="text-2xl py-1.5 uppercase"
                        style={{
                          fontFamily: style.font,
                          display: 'inline-block',
                          maxWidth: '12.5rem',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {fullName || (
                          <span className="text-base-content/60">
                            Full Name
                          </span>
                        )}
                      </span>
                      <input
                        type="radio"
                        className="kradio kradio-primary"
                        value={style.font}
                        checked={selectedStyle === style.font}
                        onChange={() => setSelectedStyle(style.font)}
                      />
                    </label>
                  ))}
                </div>
              </Tabs.Content>
            </Tabs.Root>
          </div>
          <div slot="footer">
            <div className="flex-c-cc gap-2 w-full">
              <p className="text-center text-small text-base-content/60">
                {agreementText}
              </p>
              <button
                type="button"
                className="kbtn kbtn-lg kbtn-primary kbtn-block"
                onClick={onSave}
                disabled={isSaveDisabled}
              >
                {savedButtonLabel}
              </button>
              <canvas
                ref={canvasRef}
                id="signature-canvas"
                style={{ display: 'none' }}
              ></canvas>
            </div>
          </div>
        </Modal>
      </WidgetAPI>
    );
  },
);

SignatureComponent.propTypes = {
  field: t.object.isRequired,
  disabled: t.bool,
  modalTitle: t.string,
  signaturePadLabel: t.string,
  fullNameLabel: t.string,
  agreementText: t.string,
  savedButtonLabel: t.string,
  savedFileName: t.string,
  clearButtonLabel: t.string,
  emptyLabel: t.string,
};

const SignatureProvider = forwardRef((props, ref) => (
  <Provider store={store}>
    <SignatureComponent {...props} ref={ref} />
  </Provider>
));

/**
 * Function that initializes the Signature widget. This function validates the
 * provided parameters, and then registers the widget, which will create an
 * instance of the widget and render it into the provided container.
 *
 * @param {HTMLElement} container HTML Element into which to render the widget.
 * @param {Object} field The Kinetic field object used to store the value of the signature.
 * @param {SignatureWidgetConfig} config Configuration object for the widget.
 * @param {string} [id] Optional id that can be used to retrieve a reference to
 *  the widget's API functions using the `Signature.get` function.
 */
export const Signature = ({ container, field, config, id } = {}) => {
  if (
    validateContainer(container, 'Signature') &&
    validateField(field, 'attachment', 'Signature')
  ) {
    return registerWidget(Signature, {
      container,
      Component: SignatureProvider,
      props: { ...config, field },
      id,
    });
  }
  return Promise.reject(
    'The Signature widget parameters are invalid. See the console for more details.',
  );
};

/**
 * @typedef {Object} SignatureWidgetConfig
 * @property {boolean} [disabled] Should the signature be read-only.
 *  If omitted, will use the reviewMode of the form to determine.
 * @property {string} [modalTitle] The title displayed at the top of the modal.
 * @property {string} [signaturePadLabel] The label displayed above the signature pad.
 * @property {string} [fullNameLabel] The label displayed above the signature type styles.
 * @property {string} [agreementText] The text displayed to indicate the agreement for the signature.
 * @property {string} [savedButtonLabel] The label for the "Save" button in the modal.
 * @property {string} [savedFileName] The name of the file saved after the signature is completed.
 * @property {string} [buttonLabel] The label for the signature field.
 * @property {string} [clearButtonLabel] The label for the "Clear" button next to the signature field.
 * @property {string} [emptyLabel] The text displayed when the widget is disabled and there is no signature.
 */
