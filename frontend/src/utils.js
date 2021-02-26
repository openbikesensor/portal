// Wraps the register callback from useForm into a new ref function, such that
// any child of the provided element that is an input component will be
// registered.
export function findInput(register) {
  return (element) => {
    const found = element ? element.querySelector('input, textarea, select, checkbox') : null
    register(found)
  }
}
