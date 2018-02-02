/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 - present Instructure, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import React, { Component } from 'react'
import PropTypes from 'prop-types'
import classnames from 'classnames'


import IconArrowOpenUp from '@instructure/ui-icons/lib/Line/IconArrowOpenUp'
import IconArrowOpenDown from '@instructure/ui-icons/lib/Line/IconArrowOpenDown'

import CustomPropTypes from '@instructure/ui-utils/lib/react/CustomPropTypes'
import themeable from '@instructure/ui-themeable'
import Locale from '@instructure/ui-utils/lib/i18n/Locale'
import isActiveElement from '@instructure/ui-utils/lib/dom/isActiveElement'
import { pickProps, omitProps } from '@instructure/ui-utils/lib/react/passthroughProps'
import transformSelection from '@instructure/ui-utils/lib/dom/transformSelection'
import uid from '@instructure/ui-utils/lib/uid'
import Decimal from '@instructure/ui-utils/lib/Decimal'
import Numeral from '@instructure/ui-utils/lib/i18n/Numeral'

import styles from './styles.css'
import theme from './theme'

import FormField from '../FormField'

const keyDirections = {
  ArrowUp: 1,
  ArrowDown: -1
}

function noop () {}

// Accepts a string locale and returns a string representing the decimal
// delimiter that is used by that locale, or '.' if the locale is not recognized.
function decimalDelimiter (locale) {
  const localeData = locale && Numeral.locales[locale.toLowerCase()]
  if (!localeData) {
    // default to using '.' as the delimiter if no locale is set or if
    // there is no Numeral locale file for the currently set locale.
    return '.'
  }

  return localeData.delimiters.decimal
}

// Accepts three strings (a string to search, a character to be replaced, and a
// character to use as the replacement) and returns a string with every instance
// of 'char' replaced with 'replaceWith'.
function replaceChar (string, char, replaceWith) {
  return string.replace(new RegExp(`\\${char}`, 'g'), replaceWith)
}

// Accepts a number and a string locale and returns a string representing the
// number in the specified locale.
function formatNumberForLocale (number, locale) {
  const delimiter = decimalDelimiter(locale)
  return replaceChar(number.toString(), '.', delimiter)
}

export function cleanValue (value, locale, allowNegative = true) {
  const delimiter = decimalDelimiter(locale)
  // Remove everything that is not numbers, delimiter nor '-'
  const alphaRemoval = value.replace(new RegExp(`[^\\d\\-\\${delimiter}]`, 'g'), '')
  const isNegative = allowNegative && alphaRemoval[0] === '-'

  // Remove all '-'s
  let minusRemoval = replaceChar(alphaRemoval, '-', '')

  // Re-add one '-' if appropriate
  if (isNegative) {
    minusRemoval = `-${minusRemoval}`
  }

  // If there is no delimiter, return the cleaned string
  const delimiterIndex = minusRemoval.indexOf(delimiter)
  if (delimiterIndex === -1) {
    return minusRemoval
  }

  // If there are one or more delimiters, only keep the first one
  const [head, tail] = minusRemoval.split(new RegExp(`\\${delimiter}(.*)`), 2)
  return head + delimiter + replaceChar(tail, delimiter, '')
}

/**
---
category: components/forms
---
**/
@themeable(theme, styles)
class NumberInput extends Component {
  static propTypes = {
    label: PropTypes.node.isRequired,
    id: PropTypes.string,
    showArrows: PropTypes.bool,
    step: PropTypes.string,
    min: PropTypes.string,
    max: PropTypes.string,
    /**
    * object with shape: `{
    * text: PropTypes.string,
    * type: PropTypes.oneOf(['error', 'hint', 'success', 'screenreader-only'])
    *   }`
    */
    messages: PropTypes.arrayOf(CustomPropTypes.message),
    /**
      A standard language id
    **/
    locale: PropTypes.string,
    size: PropTypes.oneOf(['medium', 'large']),
    layout: PropTypes.oneOf(['stacked', 'inline']),
    width: PropTypes.string,
    inline: PropTypes.bool,
    /**
    * Html placeholder text to display when the input has no value. This should be hint text, not a label
    * replacement.
    */
    placeholder: PropTypes.string,
    disabled: PropTypes.bool,
    required: PropTypes.bool,
    /**
    * a function that provides a reference to the actual input element
    */
    inputRef: PropTypes.func,
    /**
    * value to set on initial render
    */
    defaultValue: PropTypes.string,
    /**
    * the selected value (must be accompanied by an `onChange` prop)
    */
    value: CustomPropTypes.controllable(PropTypes.string),
    onChange: PropTypes.func,
    onKeyDown: PropTypes.func,
    onFocus: PropTypes.func,
    onBlur: PropTypes.func
  }

  static contextTypes = {
    locale: PropTypes.string
  }

  static defaultProps = {
    showArrows: true,
    step: '1',
    min: '',
    max: '',
    inline: false,
    size: 'medium',
    messages: [],
    disabled: false,
    layout: 'stacked',
    inputRef: function (input) {},
    onChange: function (event, value) {},
    onKeyDown: function (event) {},
    onFocus: function (event) {},
    onBlur: function (event) {}
  };

  constructor (props) {
    super()

    this._defaultId = `NumberInput_${uid()}`
  }

  _input = null;

  state = {
    focus: false
  };

  componentWillReceiveProps (nextProps) {
    if (nextProps.locale !== this.props.locale) {
      const delimiter = decimalDelimiter(this.props.locale)
      const newDelimiter = decimalDelimiter(nextProps.locale)
      this._input.value = replaceChar(this._input.value, delimiter, newDelimiter)
    }
  }

  // Replicate the arrow behavior commonly seen in inputs of type number
  applyStep = (dir) => {
    const rawValue = this._input.value
    const { min, max, step } = this.props
    const delimiter = decimalDelimiter(this.locale)
    const parseableRawValue = rawValue ? replaceChar(rawValue, delimiter, '.') : '0'
    const value = new Decimal(parseableRawValue || 0).minus(min || 0)
    const hasMin = min !== '' && min !== undefined && min !== null
    const hasMax = max !== '' && max !== undefined && max !== null

    // case when value is less than minimum
    if (hasMin && value.lt(0)) {
      if (dir < 0) {
        return rawValue || min
      }
      return min
    }

    // case when value is more than maximum
    if (hasMax && value.plus(min || 0).gt(max)) {
      if (dir > 0) {
        return rawValue || min
      }
      return max
    }

    let resultValue
    if (!value.mod(step).equals(0)) {
      // case when value is between steps, so we snap to the next step
      if (dir > 0) {
        resultValue = value.div(step).ceil().times(step)
      } else {
        resultValue = value.div(step).floor().times(step)
      }
    } else if (dir > 0) {
      resultValue = value.plus(step)
    } else {
      resultValue = value.minus(step)
    }

    if (hasMin && resultValue.lt(0)) {
      return min
    }

    resultValue = resultValue.plus(min || 0)

    if (hasMax) {
      const maxStep = new Decimal(max)
        .minus(min || 0)
        .div(step)
        .floor()
        .times(step)
        .plus(min || 0)

      if (resultValue.gt(maxStep)) {
        return maxStep.toString()
      }
    }

    return resultValue.toString()
  }

  focus () {
    this._input.focus()
  }

  get locale () {
    return this.props.locale || this.context.locale || Locale.browserLocale()
  }

  get invalid () {
    return (
      this.props.messages &&
      this.props.messages.findIndex((message) => message.type === 'error') >= 0
    )
  }

  get id () {
    return this.props.id || this._defaultId
  }

  get focused () {
    return isActiveElement(this._input)
  }

  get value () {
    return this._input.value
  }

  handleRef = (element, ...args) => {
    this._input = element
    this.props.inputRef.apply(this, [element].concat(args))
  };

  handleFocus = (event) => {
    this.setState(() => ({ focus: true }))
    this.props.onFocus(event)
  };

  handleBlur = (event) => {
    this.setState(() => ({ focus: false }))
    this.props.onBlur(event)
  };

  handleChange = (event) => {
    const { min } = this.props
    const missingMin = min === '' || min === null || min === undefined
    const newValue = cleanValue(event.target.value, this.locale, missingMin || new Decimal(min).lt(0))
    const newSelection = transformSelection(this._input, newValue)
    this._input.value = newValue
    this._input.selectionStart = newSelection.selectionStart
    this._input.selectionEnd = newSelection.selectionEnd
    this._input.selectionDirection = newSelection.selectionDirection

    this.props.onChange(event, newValue)
  };

  handleKeyDown = (event) => {
    const dir = keyDirections[event.key]

    if (dir) {
      event.preventDefault()
      const newValue = formatNumberForLocale(this.applyStep(dir), this.locale)
      this._input.value = newValue
      this.props.onKeyDown(event)
      this.props.onChange(event, newValue)
    } else {
      this.props.onKeyDown(event)
    }
  };

  handleClickUp = (event) => {
    event.preventDefault()
    const newValue = formatNumberForLocale(this.applyStep(1), this.locale)
    this._input.focus()
    this._input.value = newValue
    this.props.onChange(event, newValue)
  };

  handleClickDown = (event) => {
    event.preventDefault()
    const newValue = formatNumberForLocale(this.applyStep(-1), this.locale)
    this._input.focus()
    this._input.value = newValue
    this.props.onChange(event, newValue)
  };

  renderArrows () {
    return (
      <span className={styles.arrowContainer}>
        <span
          className={styles.arrow}
          onClick={this.handleClickUp}
          onKeyDown={noop}
          role="presentation"
        >
          <IconArrowOpenUp />
        </span>
        <span
          className={styles.arrow}
          onClick={this.handleClickDown}
          onKeyDown={noop}
          role="presentation"
        >
          <IconArrowOpenDown />
        </span>
      </span>
    )
  }

  render () {
    const {
      size,
      showArrows,
      placeholder,
      value,
      defaultValue,
      disabled,
      required,
      width,
      inline
    } = this.props

    return (
      <FormField
        {...pickProps(this.props, FormField.propTypes)}
        id={this.id}
      >
        <span
          className={classnames(styles.inputContainer, {
            [styles.invalid]: this.invalid,
            [styles.disabled]: disabled,
            [styles[size]]: size,
            [styles.focus]: this.state.focus,
            [styles.inline]: inline
          })}
          style={width ? { width } : null}
        >
          <input
            {...omitProps(this.props, NumberInput.propTypes)}
            className={styles.input}
            onChange={this.handleChange}
            onKeyDown={this.handleKeyDown}
            onFocus={this.handleFocus}
            onBlur={this.handleBlur}
            type="text"
            inputMode="numeric"
            value={value}
            defaultValue={defaultValue && formatNumberForLocale(defaultValue, this.locale)}
            placeholder={placeholder}
            ref={this.handleRef}
            id={this.id}
            required={required}
            aria-required={required}
            aria-invalid={this.invalid ? 'true' : null}
            disabled={disabled}
            aria-disabled={disabled ? 'true' : null}
          />
          {showArrows ? this.renderArrows() : null}
        </span>
      </FormField>
    )
  }
}

export default NumberInput