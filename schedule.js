/*
 * The season is written down once, in events.html, and nowhere else. This
 * script reads the dates back out of those cards so the events page can put
 * what is still to come first, and so the homepage band can name the next
 * service without anybody editing it every week.
 *
 * Everything here is an enhancement. With this file missing, blocked, or
 * broken, the events page still lists all nine services in document order and
 * the homepage still says "Sunday evening services at 6:00 pm" — which is true
 * on any date. Nothing is ever hidden; past services are dimmed, not removed.
 */
(function () {
  'use strict';

  var MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  var DAYS = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday',
    'Thursday', 'Friday', 'Saturday'
  ];

  /* An ISO date handed to Date.parse is read as UTC, which lands on the
     previous day everywhere in the United States. Build it from its parts so
     it means local midnight, which is what a date on a poster means. */
  function parseLocalDate(iso) {
    var parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso == null ? '' : iso).trim());
    if (!parts) return null;
    var year = Number(parts[1]);
    var month = Number(parts[2]) - 1;
    var day = Number(parts[3]);
    var date = new Date(year, month, day);
    if (isNaN(date.getTime())) return null;
    /* Rejects 2026-02-31 and friends, which JavaScript would happily roll
       forward into March rather than treating as the typo it is. */
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
      return null;
    }
    return date;
  }

  /* Returns {date, title, element} for every readable card, earliest first. A
     card with no usable date is left out of the ordering rather than guessed
     at — it stays on the page exactly where the author put it. */
  function readEvents(root) {
    var events = [];
    Array.prototype.forEach.call(
      root.querySelectorAll('.event-card[data-event-date]'),
      function (element) {
        var date = parseLocalDate(element.getAttribute('data-event-date'));
        if (!date) return;
        events.push({
          date: date,
          title: (element.getAttribute('data-event-title') || '').trim(),
          element: element
        });
      }
    );
    events.sort(function (a, b) { return a.date - b.date; });
    return events;
  }

  /* An event belongs to the whole of its own day: tonight's service is still
     upcoming at eleven o'clock tonight, and only becomes past tomorrow. */
  function partition(events, today) {
    var cutoff = new Date(
      today.getFullYear(), today.getMonth(), today.getDate()
    ).getTime();
    var past = [];
    var upcoming = [];
    events.forEach(function (event) {
      if (event.date.getTime() < cutoff) past.push(event);
      else upcoming.push(event);
    });
    return { past: past, upcoming: upcoming };
  }

  function formatDate(date) {
    return DAYS[date.getDay()] + ', ' + MONTHS[date.getMonth()] + ' ' + date.getDate();
  }

  function groupHeading(text) {
    var heading = document.createElement('h2');
    heading.className = 'schedule-group';
    heading.textContent = text;
    return heading;
  }

  /* The flag is words, not a tint. Strip every colour from the page and it
     still says which service is the next one. */
  function flagAsNext(element) {
    element.classList.add('is-next');
    var flag = document.createElement('p');
    flag.className = 'event-flag';
    flag.textContent = 'Next service';
    element.insertBefore(flag, element.firstChild);
  }

  function orderEventsPage() {
    var list = document.querySelector('[data-schedule="events"]');
    if (!list) return;

    var events = readEvents(list);
    if (events.length === 0) return;

    var split = partition(events, new Date());
    var ordered = document.createDocumentFragment();

    /* A heading only appears when it has something under it: no "Earlier this
       season" before the season starts, no "Upcoming" once it has ended. */
    if (split.upcoming.length > 0) {
      ordered.appendChild(groupHeading('Upcoming'));
      split.upcoming.forEach(function (event, index) {
        if (index === 0) flagAsNext(event.element);
        ordered.appendChild(event.element);
      });
    }
    if (split.past.length > 0) {
      ordered.appendChild(groupHeading('Earlier this season'));
      split.past.forEach(function (event) {
        event.element.classList.add('is-past');
        ordered.appendChild(event.element);
      });
    }

    /* Appending moves the existing cards rather than copying them, so nothing
       is duplicated and nothing is thrown away. */
    list.appendChild(ordered);
  }

  function fillNextServiceBand() {
    var band = document.getElementById('next-service');
    if (!band || !window.fetch || !window.DOMParser) return;

    var eyebrow = band.querySelector('[data-ns="eyebrow"]');
    var headline = band.querySelector('[data-ns="headline"]');
    var meta = band.querySelector('[data-ns="meta"]');
    if (!eyebrow || !headline || !meta) return;

    /* fetch() cannot read a file:// page, so opening index.html straight off
       the disk leaves the standing sentence in place. That is the correct
       outcome, not a bug to work around. */
    fetch('events.html', { credentials: 'same-origin' })
      .then(function (response) {
        if (!response.ok) throw new Error('events.html responded ' + response.status);
        return response.text();
      })
      .then(function (markup) {
        var parsed = new DOMParser().parseFromString(markup, 'text/html');
        var next = partition(readEvents(parsed), new Date()).upcoming[0];
        /* Off season there is nothing truer to say than what is already
           written here, so say nothing. */
        if (!next || !next.title) return;
        eyebrow.textContent = 'Next service';
        headline.textContent = formatDate(next.date);
        meta.textContent = next.title + ' · 6:00 pm in the chapel';
      })
      .catch(function () {
        /* The markup the visitor is already looking at is true. Leave it. */
      });
  }

  orderEventsPage();
  fillNextServiceBand();
})();
