import * as Antd from 'antd';
import 'codemirror/lib/codemirror.css';
// import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/jsx/jsx';
import 'codemirror/theme/material.css';
import _ from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { Controlled as CodeMirror } from 'react-codemirror2';
import ReactDOM from 'react-dom';
import { DragSizing } from 'react-drag-sizing';
import Helmet from 'react-helmet';
import { useHistory, useParams } from 'react-router';
import styled from 'styled-components';
import useMedia from 'use-media';
import immer from 'immer';
import Axios from 'axios';
import moment from 'moment';
import { GentleSpin } from '../components/GentleSpin';
import { useApi } from '../hooks/useApi';
import { useFormBinding } from '../hooks/useFormBinding';
import { useInterval } from '../hooks/useInterval';
import { useModel } from '../hooks/useModel';
import { useTrigger } from '../hooks/useTrigger';
import { babelTransform } from './babelMaster';
import './page.css';
import { MainCol, MainRow, MountNode } from './styled';
import {
  displayError,
  loadJsForceUmd,
  loadJs,
  loadCss,
  appendJs,
  appendCss,
  wrapCode,
} from './util';

Object.assign(window, {
  useFormBinding,
  useInterval,
  useModel,
  moment,
  styled,
  immer,
  _,
  axios: Axios,
  Antd,
  React,
  ReactDOM,
  displayError,
  loadJsForceUmd,
  loadJs,
  loadCss,
  appendJs,
  appendCss,
  setRendering: _.noop, // noop placeholder
});

// let storeKeyCode = 'playground__initialCode';

export let Playground: React.FC = () => {
  let history = useHistory();
  let { file } = useParams() as { file: string };
  // let initialCode = useMemo(() => {
  //   return localStorage.getItem(storeKeyCode) || _initialCode;
  // }, []);
  let initialCode = '';
  let codeBinding = useFormBinding(initialCode, (editor, data, value) => value);

  let {
    request: reqIndex,
    response: respIndex,
    loading: loadingIndex,
  } = useApi<string>('GET', 'code/index.yml');
  let {
    request: reqCode,
    error: errReqCode,
    response: respCode,
    loading: loadingCode,
  } = useApi<string>('GET', 'code/:file');
  let preloading = loadingIndex || loadingCode;

  useEffect(() => {
    if (file) {
      reqCode({ pathParams: { file } });
    } else {
      reqIndex();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  useEffect(() => {
    if (respIndex == null) return;
    let txt = respIndex.data;
    let list = txt
      .split(/\n/)
      .map(s => s.replace(/#.*/, '').trim())
      .filter(Boolean)
      .map(v => v.replace(/^-\s*/, ''));
    let defaults = list[0];
    // reqCode({ pathParams: { file: file || defaults } });
    history.push(`/playground/${file || defaults}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, respIndex]);

  useEffect(() => {
    if (respCode == null) return;
    codeBinding.controlled.onChange(null, null, respCode.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [respCode]);

  useEffect(() => {
    // if (errReqCode && String(errReqCode).includes('status code 404')) {
    //   history.push('/'); // force redirect
    // }
    if (errReqCode) {
      displayError(new Error(`${errReqCode.message} - ${file}`));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errReqCode]);

  let [preview, setPreview] = useState('');
  let [compiling, setCompiling] = useState(false);
  let [rendering, setRendering] = useState(false);
  let previewLoading = preloading || compiling || rendering;

  Object.assign(window, { setRendering }); // without side-effect

  let doPreview = useCallback(
    async (code: string) => {
      if (!code) return;
      setCompiling(true);
      try {
        let res = wrapCode(code);
        let hasJsx = file && ['.jsx', '.tsx'].some(ext => file.endsWith(ext));
        let hasTs = file && ['.ts', '.tsx'].some(ext => file.endsWith(ext));
        if (hasJsx || hasTs) res = await babelTransform(res, file);
        setPreview(res);
      } catch (err) {
        displayError(err);
      } finally {
        setCompiling(false);
      }
    },
    [file]
  );

  // let persistEditor = useCallback((code: string) => {
  //   localStorage.setItem(storeKeyCode, code);
  // }, []);

  useTrigger(
    {
      debounce: 1000,
      // initial: true,
      cancel: true,
      singleton: true,
    },
    doPreview,
    [codeBinding.value]
  );
  window.triggerPreview = () => {
    // doPreview(codeBinding.value);
    doPreview(codeBinding.value + `\n\n/* ${new Date()} */`);
  };

  // useTrigger(
  //   {
  //     throttle: 1000,
  //   },
  //   persistEditor,
  //   [codeBinding.value]
  // );

  // keeping sync'd with styled.ts (medium=768px)
  let isGreaterThanMedium = useMedia({ minWidth: '768px' });

  let handleSizingUpdate = useCallback(() => {
    let event = new Event('resize');
    window.mountNode.dispatchEvent(event);
  }, []);

  useEffect(() => {
    window.addEventListener('resize', handleSizingUpdate);
    return () => {
      window.removeEventListener('resize', handleSizingUpdate);
    };
  }, [handleSizingUpdate]);

  return (
    <div className="page-playground">
      <Helmet>
        <title>Playground{file ? ` - ${file}` : ''}</title>
        <style>{`html { overflow: hidden } #root { height: 100% }`}</style>
        <script>{preview}</script>
      </Helmet>
      <MainRow>
        <MainCol style={{ flex: 1, overflowX: 'auto' }}>
          <GentleSpin spinning={previewLoading}>
            <MountNode id="mountNode" />
            <div id="assetsNode" />
          </GentleSpin>
        </MainCol>
        <DragSizing
          onUpdate={handleSizingUpdate}
          {...(isGreaterThanMedium
            ? {
                border: 'left',
                style: {
                  minWidth: '20%',
                  maxWidth: '80%',
                  width: '50%',
                },
              }
            : {
                border: 'top',
                style: {
                  minHeight: '20%',
                  maxHeight: '80%',
                  height: '50%',
                },
              })}
        >
          <MainCol>
            <CodeMirror
              className="main-editor"
              options={{
                mode: 'text/typescript-jsx',
                theme: 'material',
                lineNumbers: true,
              }}
              value={codeBinding.controlled.value}
              onBeforeChange={codeBinding.controlled.onChange}
            />
          </MainCol>
        </DragSizing>
      </MainRow>
    </div>
  );
};
