const asyncState = {
  status: 'idle'
};

function AsyncStatusButton() {
  return {
    $$typeof: 'react.test.element',
    type: 'button',
    key: null,
    props: {
      onClick() {
        asyncState.status = 'loading';
        setTimeout(() => {
          asyncState.status = 'saved';
        }, 0);
      },
      children: `Status ${asyncState.status}`
    }
  };
}

function resetAsyncStatusButton() {
  asyncState.status = 'idle';
}

module.exports = {
  AsyncStatusButton,
  resetAsyncStatusButton
};
